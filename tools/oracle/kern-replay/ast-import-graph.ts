/**
 * @file tools/oracle/kern-replay/ast-import-graph.ts
 * TypeScript AST-based transitive import-graph collector & legacy-import ratchet gate evaluator.
 *
 * Uses the real `typescript` compiler AST (not regexes) to track:
 * - Static ES `import` / `export ... from` (partitioned into `value` vs `type-only`),
 * - `import x = require('...')` and `import type x = require('...')`,
 * - Type-level `import('...').T` / `typeof import('...')` (`ImportTypeNode`),
 * - Dynamic `import('...')` and no-substitution template ``import(`...`)``,
 * - CommonJS `require('...')` and `createRequire(...)('...')` (including aliased bindings),
 * - Triple-slash `/// <reference path="..." />` directives,
 * - Root-relative `/src/...` and relative `./` / `../` specifiers (with `.js`->`.ts` twin resolution),
 * - Opaque / dynamic constructs (`import(x)`, ``import(`${x}`)``, `require(x)`, untracked
 *   `createRequire`, `import.meta.glob`/`resolve`/`[...]`, `new URL(..., import.meta.url)`,
 *   `URL.parse`, `eval`, `Function`, `getBuiltinModule`, `file:` URLs, out-of-repo escapes).
 */

import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import * as ts from 'typescript'

export type AstImportEdgeKind = 'value' | 'type-only'

export type AstImportSyntax =
  | 'import'
  | 'export-from'
  | 'import-equals'
  | 'import-type'
  | 'declare-module'
  | 'dynamic-import'
  | 'dynamic-import-template'
  | 'require'
  | 'create-require'
  | 'triple-slash-ref'

export type OpaqueConstructKind =
  | 'import-nonliteral'
  | 'export-nonliteral'
  | 'import-equals-nonliteral'
  | 'import-type-nonliteral'
  | 'dynamic-import-nonliteral'
  | 'require-nonliteral'
  | 'create-require-untracked'
  | 'import-meta-loader'
  | 'new-url-import-meta'
  | 'dynamic-eval-or-builtin'
  | 'file-url-import'
  | 'out-of-repo-import'

export interface AstImportEdge {
  readonly from: string
  readonly to: string
  readonly specifier: string
  readonly kind: AstImportEdgeKind
  readonly syntax: AstImportSyntax
  readonly line: number
}

export interface OpaqueConstruct {
  readonly file: string
  readonly kind: OpaqueConstructKind
  readonly text: string
  readonly line: number
}

export interface UnresolvedImport {
  readonly file: string
  readonly specifier: string
  readonly kind: AstImportEdgeKind
  readonly syntax: AstImportSyntax
  readonly line: number
}

export interface AstImportGraphHost {
  readonly fileExists: (absPath: string) => boolean
  readonly readFile: (absPath: string) => string
  readonly isOverridden?: (absPath: string) => boolean
}

export interface ParsedFileEdge {
  readonly specifier: string
  readonly kind: AstImportEdgeKind
  readonly syntax: AstImportSyntax
  readonly line: number
}

export interface ParsedFileOpaque {
  readonly kind: OpaqueConstructKind
  readonly text: string
  readonly line: number
}

export interface ParsedFileDependencies {
  readonly edges: readonly ParsedFileEdge[]
  readonly opaques: readonly ParsedFileOpaque[]
}

export interface CollectAstImportGraphOptions {
  readonly host?: AstImportGraphHost
  readonly stopAt?: ReadonlySet<string> | readonly string[]
  readonly parseCache?: Map<string, ParsedFileDependencies>
}

export interface AstImportGraph {
  readonly entry: string
  readonly allFiles: ReadonlySet<string>
  readonly valueReachable: ReadonlySet<string>
  readonly typeOnlyReachable: ReadonlySet<string>
  readonly directValueFiles: readonly string[]
  readonly directTypeOnlyFiles: readonly string[]
  readonly edges: readonly AstImportEdge[]
  readonly packages: readonly string[]
  readonly opaques: readonly OpaqueConstruct[]
  readonly unresolved: readonly UnresolvedImport[]
}

export type ReachabilityStatus = 'value' | 'type-only' | 'none'

export interface NamedFileStatus {
  readonly file: string
  readonly direct: ReachabilityStatus
  readonly transitive: ReachabilityStatus
  readonly chain: string | null
}

export interface LegacyImportGatePolicy {
  readonly allowedDirectValue: readonly string[]
  readonly allowedDirectTypeOnly: readonly string[]
  readonly allowedTransitiveValue: readonly string[]
  readonly allowedTransitiveTypeOnly: readonly string[]
  readonly legacyPrefixes?: readonly string[]
  readonly allowedRootPrefixes?: readonly string[]
  readonly exemptFiles?: readonly string[]
  readonly forbidNonItemsServer?: boolean
  readonly namedFiles?: readonly string[]
}

export interface LegacyImportGateReport {
  readonly ok: boolean
  readonly directLegacyValue: readonly string[]
  readonly directLegacyTypeOnly: readonly string[]
  readonly transitiveLegacyValue: readonly string[]
  readonly transitiveLegacyTypeOnly: readonly string[]
  readonly nonItemsServerFiles: readonly string[]
  readonly outsideAllowedRoots: readonly string[]
  readonly namedFileStatuses: Readonly<Record<string, NamedFileStatus>>
  readonly unexpectedDirectValue: readonly string[]
  readonly staleDirectValue: readonly string[]
  readonly unexpectedDirectTypeOnly: readonly string[]
  readonly staleDirectTypeOnly: readonly string[]
  readonly unexpectedTransitiveValue: readonly string[]
  readonly staleTransitiveValue: readonly string[]
  readonly unexpectedTransitiveTypeOnly: readonly string[]
  readonly staleTransitiveTypeOnly: readonly string[]
  readonly violations: readonly string[]
}

const DEFAULT_LEGACY_PREFIXES: readonly string[] = ['src/common/', 'src/server/']
const DEFAULT_ALLOWED_ROOT_PREFIXES: readonly string[] = [
  'src/d2kern-113c/',
  'src/netproto/',
  'src/common/',
  'src/server/',
]
const IMPORT_META_LOADER_PROPS = new Set(['glob', 'globEager', 'resolve'])
const GLOBAL_OBJECT_NAMES = new Set(['globalThis', 'window', 'self', 'global'])

function toPosix(p: string): string {
  return p.replace(/\\/g, '/')
}

function normalizeRelPath(repoRoot: string, relOrAbs: string): string {
  const abs = resolve(repoRoot, relOrAbs)
  return toPosix(relative(resolve(repoRoot), abs))
}

export function createFsHost(): AstImportGraphHost {
  return {
    fileExists(absPath: string): boolean {
      if (!existsSync(absPath)) return false
      try {
        return statSync(absPath).isFile()
      } catch {
        return false
      }
    },
    readFile(absPath: string): string {
      return readFileSync(absPath, 'utf8')
    },
  }
}

export function createMemoryHost(
  repoRoot: string,
  files: Readonly<Record<string, string>>,
): AstImportGraphHost {
  const rootAbs = resolve(repoRoot)
  const map = new Map<string, string>()
  for (const [k, content] of Object.entries(files)) {
    map.set(resolve(rootAbs, k), content)
  }
  return {
    fileExists(absPath: string): boolean {
      return map.has(resolve(absPath))
    },
    readFile(absPath: string): string {
      const key = resolve(absPath)
      const content = map.get(key)
      if (content === undefined) {
        throw new Error(`Virtual file not found: ${key}`)
      }
      return content
    },
    isOverridden(): boolean {
      return true
    },
  }
}

export function createOverlayHost(
  repoRoot: string,
  overrides: Readonly<Record<string, string>>,
  baseHost?: AstImportGraphHost,
): AstImportGraphHost {
  const base = baseHost ?? createFsHost()
  const rootAbs = resolve(repoRoot)
  const map = new Map<string, string>()
  for (const [k, content] of Object.entries(overrides)) {
    map.set(resolve(rootAbs, k), content)
  }
  return {
    fileExists(absPath: string): boolean {
      const key = resolve(absPath)
      return map.has(key) || base.fileExists(key)
    },
    readFile(absPath: string): string {
      const key = resolve(absPath)
      const overridden = map.get(key)
      if (overridden !== undefined) return overridden
      return base.readFile(key)
    },
    isOverridden(absPath: string): boolean {
      const key = resolve(absPath)
      return map.has(key) || (base.isOverridden !== undefined && base.isOverridden(key))
    },
  }
}

function scriptKindFor(filePath: string): ts.ScriptKind {
  const ext = extname(filePath).toLowerCase()
  switch (ext) {
    case '.tsx':
      return ts.ScriptKind.TSX
    case '.jsx':
      return ts.ScriptKind.JSX
    case '.js':
    case '.mjs':
    case '.cjs':
      return ts.ScriptKind.JS
    case '.json':
      return ts.ScriptKind.JSON
    default:
      return ts.ScriptKind.TS
  }
}

function lineOf(sf: ts.SourceFile, node: ts.Node): number {
  return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1
}

function isErasedValueWrapper(node: ts.Node): boolean {
  return (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isTypeAssertionExpression(node) ||
    ts.isNonNullExpression(node) ||
    ts.isSatisfiesExpression(node)
  )
}

function unwrapParens(expr: ts.Expression): ts.Expression {
  let cur = expr
  while (ts.isParenthesizedExpression(cur)) {
    cur = cur.expression
  }
  return cur
}

function unwrapValueExpr(expr: ts.Expression): ts.Expression {
  let cur = expr
  while (
    ts.isParenthesizedExpression(cur) ||
    ts.isAsExpression(cur) ||
    ts.isTypeAssertionExpression(cur) ||
    ts.isNonNullExpression(cur) ||
    ts.isSatisfiesExpression(cur)
  ) {
    cur = cur.expression
  }
  return cur
}

function unwrapCommaExpr(expr: ts.Expression): ts.Expression {
  let cur = unwrapValueExpr(expr)
  while (
    ts.isBinaryExpression(cur) &&
    cur.operatorToken.kind === ts.SyntaxKind.CommaToken
  ) {
    cur = unwrapValueExpr(cur.right)
  }
  return cur
}

function extractStaticString(
  expr: ts.Expression | undefined,
): { readonly value: string; readonly isTemplate: boolean } | null {
  if (expr === undefined) return null
  const unwrapped = unwrapParens(expr)
  if (ts.isStringLiteral(unwrapped)) {
    return { value: unwrapped.text, isTemplate: false }
  }
  if (ts.isNoSubstitutionTemplateLiteral(unwrapped)) {
    return { value: unwrapped.text, isTemplate: true }
  }
  return null
}

function extractPropertyKeyString(expr: ts.Expression | undefined): string | null {
  if (expr === undefined) return null
  const unwrapped = unwrapValueExpr(expr)
  if (ts.isStringLiteral(unwrapped) || ts.isNoSubstitutionTemplateLiteral(unwrapped)) {
    return unwrapped.text
  }
  return null
}

function isImportMetaExpr(node: ts.Node): node is ts.MetaProperty {
  return (
    ts.isMetaProperty(node) &&
    node.keywordToken === ts.SyntaxKind.ImportKeyword &&
    node.name.text === 'meta'
  )
}

function getPropertyAccessInfo(
  node: ts.Expression,
): { readonly receiver: ts.Expression; readonly name: string } | null {
  const u = unwrapValueExpr(node)
  if (ts.isPropertyAccessExpression(u)) {
    return { receiver: u.expression, name: u.name.text }
  }
  if (ts.isElementAccessExpression(u)) {
    const key = extractPropertyKeyString(u.argumentExpression)
    if (key !== null) {
      return { receiver: u.expression, name: key }
    }
  }
  return null
}

function getPropertyAccessName(node: ts.Expression): string | null {
  const info = getPropertyAccessInfo(node)
  return info !== null ? info.name : null
}

function isInsideTypeContext(node: ts.Node): boolean {
  let cur: ts.Node | undefined = node.parent
  while (cur !== undefined) {
    if (
      ts.isTypeNode(cur) ||
      ts.isInterfaceDeclaration(cur) ||
      ts.isTypeAliasDeclaration(cur) ||
      ts.isTypeParameterDeclaration(cur) ||
      (ts.isHeritageClause(cur) && cur.token === ts.SyntaxKind.ImplementsKeyword)
    ) {
      return true
    }
    cur = cur.parent
  }
  return false
}

function isNonValueIdentifierPosition(id: ts.Identifier): boolean {
  if (isInsideTypeContext(id)) return true
  const parent = id.parent
  if (parent === undefined) return false

  if (ts.isPropertyAccessExpression(parent) && parent.name === id) return true
  if (ts.isPropertyAssignment(parent) && parent.name === id) return true
  if (ts.isPropertySignature(parent) && parent.name === id) return true
  if (ts.isMethodSignature(parent) && parent.name === id) return true

  if (ts.isVariableDeclaration(parent) && parent.name === id) return true
  if (ts.isBindingElement(parent) && (parent.name === id || parent.propertyName === id)) return true
  if (ts.isParameter(parent) && parent.name === id) return true
  if (ts.isImportClause(parent) && parent.name === id) return true
  if (ts.isNamespaceImport(parent) && parent.name === id) return true
  if (ts.isImportSpecifier(parent)) return true
  if (ts.isImportEqualsDeclaration(parent) && parent.name === id) return true
  if (ts.isNamespaceExport(parent) && parent.name === id) return true
  if (ts.isFunctionDeclaration(parent) && parent.name === id) return true
  if (ts.isFunctionExpression(parent) && parent.name === id) return true
  if (ts.isClassDeclaration(parent) && parent.name === id) return true
  if (ts.isClassExpression(parent) && parent.name === id) return true
  if (ts.isMethodDeclaration(parent) && parent.name === id) return true
  if (ts.isPropertyDeclaration(parent) && parent.name === id) return true
  if (ts.isGetAccessorDeclaration(parent) && parent.name === id) return true
  if (ts.isSetAccessorDeclaration(parent) && parent.name === id) return true
  if (ts.isEnumDeclaration(parent) && parent.name === id) return true
  if (ts.isEnumMember(parent) && parent.name === id) return true
  if (ts.isModuleDeclaration(parent) && parent.name === id) return true
  if (ts.isLabeledStatement(parent) && parent.label === id) return true
  if (ts.isBreakOrContinueStatement(parent) && parent.label === id) return true
  if (ts.isMetaProperty(parent) && parent.name === id) return true

  if (ts.isExportSpecifier(parent)) {
    const namedExports = parent.parent
    const exportDecl = namedExports?.parent
    if (
      exportDecl !== undefined &&
      ts.isExportDeclaration(exportDecl) &&
      exportDecl.moduleSpecifier !== undefined
    ) {
      return true
    }
    if (parent.propertyName !== undefined && parent.name === id) return true
    return false
  }

  if (
    ts.isBinaryExpression(parent) &&
    parent.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
    parent.left === id
  ) {
    return true
  }

  return false
}

function walkUpValueWrappers(expr: ts.Expression): ts.Node {
  let cur: ts.Node = expr
  while (cur.parent !== undefined) {
    if (isErasedValueWrapper(cur.parent)) {
      cur = cur.parent
    } else if (
      ts.isBinaryExpression(cur.parent) &&
      cur.parent.operatorToken.kind === ts.SyntaxKind.CommaToken &&
      cur.parent.right === cur
    ) {
      cur = cur.parent
    } else {
      break
    }
  }
  return cur
}

function isExportedVarDecl(decl: ts.VariableDeclaration): boolean {
  const varList = decl.parent
  if (varList === undefined || !ts.isVariableDeclarationList(varList)) return false
  const stmt = varList.parent
  if (stmt === undefined || !ts.isVariableStatement(stmt)) return false
  const mods = ts.canHaveModifiers(stmt) ? ts.getModifiers(stmt) : undefined
  return mods !== undefined && mods.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
}

function isHandledLoaderUsage(
  expr: ts.Expression,
  allowSimpleAlias: boolean,
  allowNewTarget: boolean,
): boolean {
  const top = walkUpValueWrappers(expr)
  const parent = top.parent
  if (parent === undefined) return false
  if (ts.isCallExpression(parent) && parent.expression === top) return true
  if (allowNewTarget && ts.isNewExpression(parent) && parent.expression === top) return true
  if (allowSimpleAlias) {
    if (
      ts.isVariableDeclaration(parent) &&
      parent.initializer === top &&
      ts.isIdentifier(parent.name) &&
      !isExportedVarDecl(parent)
    ) {
      return true
    }
    if (
      ts.isBinaryExpression(parent) &&
      parent.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      parent.right === top &&
      ts.isIdentifier(parent.left)
    ) {
      return true
    }
  }
  return false
}

function isHandledImportMetaUsage(expr: ts.Expression): boolean {
  const top = walkUpValueWrappers(expr)
  const parent = top.parent
  if (parent === undefined) return false
  if (
    (ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) &&
    parent.expression === top
  ) {
    return true
  }
  if (ts.isVariableDeclaration(parent) && parent.initializer === top) {
    if (ts.isObjectBindingPattern(parent.name)) return true
    if (ts.isIdentifier(parent.name) && !isExportedVarDecl(parent)) return true
  }
  if (
    ts.isBinaryExpression(parent) &&
    parent.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
    parent.right === top &&
    (ts.isIdentifier(parent.left) || ts.isObjectLiteralExpression(parent.left))
  ) {
    return true
  }
  return false
}

function containsImportMetaRef(node: ts.Node, importMetaUrlVars: ReadonlySet<string>): boolean {
  let found = false
  const walk = (cur: ts.Node): void => {
    if (found) return
    if (isImportMetaExpr(cur)) {
      found = true
      return
    }
    if (ts.isIdentifier(cur) && importMetaUrlVars.has(cur.text)) {
      const parent = cur.parent
      const isPropName =
        parent !== undefined &&
        ((ts.isPropertyAccessExpression(parent) && parent.name === cur) ||
          (ts.isPropertyAssignment(parent) && parent.name === cur))
      if (!isPropName) {
        found = true
        return
      }
    }
    ts.forEachChild(cur, walk)
  }
  walk(node)
  return found
}

interface CollectedAliases {
  readonly createRequireNames: Set<string>
  readonly requireNames: Set<string>
  readonly importMetaVars: Set<string>
  readonly importMetaUrlVars: Set<string>
  readonly evalNames: Set<string>
  readonly functionCtorNames: Set<string>
  readonly urlCtorNames: Set<string>
  readonly processNames: Set<string>
  readonly getBuiltinModuleNames: Set<string>
  readonly globalObjNames: Set<string>
  readonly moduleNsNames: Set<string>
  readonly converged: boolean
}

function collectAliases(sf: ts.SourceFile): CollectedAliases {
  const createRequireNames = new Set<string>(['createRequire'])
  const requireNames = new Set<string>(['require'])
  const importMetaVars = new Set<string>()
  const importMetaUrlVars = new Set<string>()
  const evalNames = new Set<string>(['eval'])
  const functionCtorNames = new Set<string>(['Function'])
  const urlCtorNames = new Set<string>(['URL'])
  const processNames = new Set<string>(['process'])
  const getBuiltinModuleNames = new Set<string>()
  const globalObjNames = new Set<string>(GLOBAL_OBJECT_NAMES)
  const moduleNsNames = new Set<string>()

  let totalNodes = 0
  const scanImportsAndCount = (node: ts.Node): void => {
    totalNodes++
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const spec = node.moduleSpecifier.text
      const clause = node.importClause
      if (clause !== undefined && !clause.isTypeOnly) {
        if (spec === 'module' || spec === 'node:module') {
          if (clause.name !== undefined) {
            moduleNsNames.add(clause.name.text)
          }
          const bindings = clause.namedBindings
          if (bindings !== undefined) {
            if (ts.isNamespaceImport(bindings)) {
              moduleNsNames.add(bindings.name.text)
            } else if (ts.isNamedImports(bindings)) {
              for (const el of bindings.elements) {
                if (el.isTypeOnly) continue
                const orig = el.propertyName !== undefined ? el.propertyName.text : el.name.text
                if (orig === 'createRequire') {
                  createRequireNames.add(el.name.text)
                }
              }
            }
          }
        } else if (spec === 'process' || spec === 'node:process') {
          if (clause.name !== undefined) {
            processNames.add(clause.name.text)
          }
          const bindings = clause.namedBindings
          if (bindings !== undefined) {
            if (ts.isNamespaceImport(bindings)) {
              processNames.add(bindings.name.text)
            } else if (ts.isNamedImports(bindings)) {
              for (const el of bindings.elements) {
                if (el.isTypeOnly) continue
                const orig = el.propertyName !== undefined ? el.propertyName.text : el.name.text
                if (orig === 'getBuiltinModule') {
                  getBuiltinModuleNames.add(el.name.text)
                }
              }
            }
          }
        }
      }
    }
    ts.forEachChild(node, scanImportsAndCount)
  }
  scanImportsAndCount(sf)

  const isGlobalObjRef = (expr: ts.Expression): boolean => {
    const u = unwrapCommaExpr(expr)
    return ts.isIdentifier(u) && globalObjNames.has(u.text)
  }

  const isProcessRef = (expr: ts.Expression): boolean => {
    const u = unwrapCommaExpr(expr)
    if (ts.isIdentifier(u) && processNames.has(u.text)) return true
    const info = getPropertyAccessInfo(u)
    return info !== null && info.name === 'process' && isGlobalObjRef(info.receiver)
  }

  const isImportMetaRef = (expr: ts.Expression): boolean => {
    const u = unwrapCommaExpr(expr)
    if (isImportMetaExpr(u)) return true
    return ts.isIdentifier(u) && importMetaVars.has(u.text)
  }

  const isCreateRequireRef = (expr: ts.Expression): boolean => {
    const u = unwrapCommaExpr(expr)
    if (ts.isIdentifier(u) && createRequireNames.has(u.text)) return true
    const info = getPropertyAccessInfo(u)
    if (info !== null && info.name === 'createRequire') return true
    return false
  }

  const isRequireRef = (expr: ts.Expression): boolean => {
    const u = unwrapCommaExpr(expr)
    if (ts.isIdentifier(u) && requireNames.has(u.text)) return true
    const info = getPropertyAccessInfo(u)
    return info !== null && info.name === 'require'
  }

  const isCreateRequireCall = (expr: ts.Expression): boolean => {
    const u = unwrapValueExpr(expr)
    return ts.isCallExpression(u) && isCreateRequireRef(u.expression)
  }

  const isEvalRef = (expr: ts.Expression): boolean => {
    const u = unwrapCommaExpr(expr)
    if (ts.isIdentifier(u) && evalNames.has(u.text)) return true
    const info = getPropertyAccessInfo(u)
    return info !== null && info.name === 'eval' && isGlobalObjRef(info.receiver)
  }

  const isFunctionCtorRef = (expr: ts.Expression): boolean => {
    const u = unwrapCommaExpr(expr)
    if (ts.isIdentifier(u) && functionCtorNames.has(u.text)) return true
    const info = getPropertyAccessInfo(u)
    return info !== null && info.name === 'Function' && isGlobalObjRef(info.receiver)
  }

  const isUrlCtorRef = (expr: ts.Expression): boolean => {
    const u = unwrapCommaExpr(expr)
    if (ts.isIdentifier(u) && urlCtorNames.has(u.text)) return true
    const info = getPropertyAccessInfo(u)
    return info !== null && info.name === 'URL' && isGlobalObjRef(info.receiver)
  }

  const isGetBuiltinModuleRef = (expr: ts.Expression): boolean => {
    const u = unwrapCommaExpr(expr)
    if (ts.isIdentifier(u) && getBuiltinModuleNames.has(u.text)) return true
    const info = getPropertyAccessInfo(u)
    return (
      info !== null &&
      info.name === 'getBuiltinModule' &&
      (isProcessRef(info.receiver) || isGlobalObjRef(info.receiver))
    )
  }

  const propagateIdent = (name: string, rhs: ts.Expression): boolean => {
    let changed = false
    if (isGlobalObjRef(rhs) && !globalObjNames.has(name)) {
      globalObjNames.add(name)
      changed = true
    }
    if (isProcessRef(rhs) && !processNames.has(name)) {
      processNames.add(name)
      changed = true
    }
    if (isCreateRequireRef(rhs) && !createRequireNames.has(name)) {
      createRequireNames.add(name)
      changed = true
    }
    if ((isCreateRequireCall(rhs) || isRequireRef(rhs)) && !requireNames.has(name)) {
      requireNames.add(name)
      changed = true
    }
    if (isImportMetaRef(rhs) && !importMetaVars.has(name)) {
      importMetaVars.add(name)
      changed = true
    }
    if (containsImportMetaRef(rhs, importMetaUrlVars) && !importMetaUrlVars.has(name)) {
      importMetaUrlVars.add(name)
      changed = true
    }
    if (isEvalRef(rhs) && !evalNames.has(name)) {
      evalNames.add(name)
      changed = true
    }
    if (isFunctionCtorRef(rhs) && !functionCtorNames.has(name)) {
      functionCtorNames.add(name)
      changed = true
    }
    if (isUrlCtorRef(rhs) && !urlCtorNames.has(name)) {
      urlCtorNames.add(name)
      changed = true
    }
    if (isGetBuiltinModuleRef(rhs) && !getBuiltinModuleNames.has(name)) {
      getBuiltinModuleNames.add(name)
      changed = true
    }
    return changed
  }

  const maxPasses = Math.max(64, totalNodes + 8)
  let converged = false

  // Fixed-point alias propagation across declarations, parameters, and assignments until convergence
  for (let pass = 0; pass < maxPasses; pass++) {
    let changed = false
    const scanDecls = (node: ts.Node): void => {
      if (ts.isVariableDeclaration(node) && node.initializer !== undefined) {
        const init = node.initializer
        if (ts.isIdentifier(node.name)) {
          if (propagateIdent(node.name.text, init)) changed = true
        } else if (ts.isObjectBindingPattern(node.name)) {
          const initHasImportMeta = containsImportMetaRef(init, importMetaUrlVars)
          const initIsGlobal = isGlobalObjRef(init)
          const initIsProcess = isProcessRef(init)
          for (const el of node.name.elements) {
            if (!ts.isIdentifier(el.name)) continue
            const orig =
              el.propertyName !== undefined && ts.isIdentifier(el.propertyName)
                ? el.propertyName.text
                : el.propertyName !== undefined && ts.isStringLiteral(el.propertyName)
                  ? el.propertyName.text
                  : el.name.text
            if (orig === 'createRequire' && !createRequireNames.has(el.name.text)) {
              createRequireNames.add(el.name.text)
              changed = true
            }
            if (orig === 'require' && !requireNames.has(el.name.text)) {
              requireNames.add(el.name.text)
              changed = true
            }
            if (initHasImportMeta && !importMetaUrlVars.has(el.name.text)) {
              importMetaUrlVars.add(el.name.text)
              changed = true
            }
            if (orig === 'getBuiltinModule' && !getBuiltinModuleNames.has(el.name.text)) {
              if (initIsProcess || initIsGlobal) {
                getBuiltinModuleNames.add(el.name.text)
                changed = true
              }
            }
            if (initIsGlobal) {
              if (orig === 'eval' && !evalNames.has(el.name.text)) {
                evalNames.add(el.name.text)
                changed = true
              }
              if (orig === 'Function' && !functionCtorNames.has(el.name.text)) {
                functionCtorNames.add(el.name.text)
                changed = true
              }
              if (orig === 'URL' && !urlCtorNames.has(el.name.text)) {
                urlCtorNames.add(el.name.text)
                changed = true
              }
              if (orig === 'process' && !processNames.has(el.name.text)) {
                processNames.add(el.name.text)
                changed = true
              }
            }
          }
        }
      } else if (
        ts.isParameter(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer !== undefined
      ) {
        if (propagateIdent(node.name.text, node.initializer)) changed = true
      } else if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isIdentifier(node.left)
      ) {
        if (propagateIdent(node.left.text, node.right)) changed = true
      }
      ts.forEachChild(node, scanDecls)
    }
    scanDecls(sf)
    if (!changed) {
      converged = true
      break
    }
  }

  return {
    createRequireNames,
    requireNames,
    importMetaVars,
    importMetaUrlVars,
    evalNames,
    functionCtorNames,
    urlCtorNames,
    processNames,
    getBuiltinModuleNames,
    globalObjNames,
    moduleNsNames,
    converged,
  }
}

function isImmediateCallExpressionTarget(callNode: ts.CallExpression): boolean {
  const top = walkUpValueWrappers(callNode)
  return (
    top.parent !== undefined &&
    ts.isCallExpression(top.parent) &&
    top.parent.expression === top
  )
}

function isSimpleVarDeclInitializer(callNode: ts.CallExpression): boolean {
  const top = walkUpValueWrappers(callNode)
  if (
    top.parent !== undefined &&
    ts.isVariableDeclaration(top.parent) &&
    top.parent.initializer === top &&
    ts.isIdentifier(top.parent.name) &&
    !isExportedVarDecl(top.parent)
  ) {
    return true
  }
  if (
    top.parent !== undefined &&
    ts.isBinaryExpression(top.parent) &&
    top.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
    top.parent.right === top &&
    ts.isIdentifier(top.parent.left)
  ) {
    return true
  }
  return false
}

export function extractFileDependenciesAst(
  filePath: string,
  sourceText: string,
): ParsedFileDependencies {
  const sf = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(filePath),
  )

  const edges: ParsedFileEdge[] = []
  const opaques: ParsedFileOpaque[] = []
  const aliases = collectAliases(sf)
  const {
    createRequireNames,
    requireNames,
    importMetaVars,
    importMetaUrlVars,
    evalNames,
    functionCtorNames,
    urlCtorNames,
    processNames,
    getBuiltinModuleNames,
    globalObjNames,
    moduleNsNames,
    converged,
  } = aliases

  if (!converged) {
    opaques.push({
      kind: 'dynamic-eval-or-builtin',
      text: 'alias-propagation-non-convergent',
      line: 1,
    })
  }

  const isGlobalObjExpr = (expr: ts.Expression): boolean => {
    const u = unwrapCommaExpr(expr)
    return ts.isIdentifier(u) && globalObjNames.has(u.text)
  }

  const isProcessExpr = (expr: ts.Expression): boolean => {
    const u = unwrapCommaExpr(expr)
    if (ts.isIdentifier(u) && processNames.has(u.text)) return true
    const info = getPropertyAccessInfo(u)
    return info !== null && info.name === 'process' && isGlobalObjExpr(info.receiver)
  }

  const isModuleNsExpr = (expr: ts.Expression): boolean => {
    const u = unwrapCommaExpr(expr)
    return ts.isIdentifier(u) && moduleNsNames.has(u.text)
  }

  const isImportMetaOrAlias = (expr: ts.Expression): boolean => {
    const u = unwrapCommaExpr(expr)
    if (isImportMetaExpr(u)) return true
    return ts.isIdentifier(u) && importMetaVars.has(u.text)
  }

  const isUrlConstructorExpr = (expr: ts.Expression): boolean => {
    const u = unwrapCommaExpr(expr)
    if (ts.isIdentifier(u) && urlCtorNames.has(u.text)) return true
    const info = getPropertyAccessInfo(u)
    return info !== null && info.name === 'URL' && isGlobalObjExpr(info.receiver)
  }

  const isFunctionConstructorExpr = (expr: ts.Expression): boolean => {
    const u = unwrapCommaExpr(expr)
    if (ts.isIdentifier(u) && functionCtorNames.has(u.text)) return true
    const info = getPropertyAccessInfo(u)
    return info !== null && info.name === 'Function' && isGlobalObjExpr(info.receiver)
  }

  const isEvalCalleeExpr = (expr: ts.Expression): boolean => {
    const u = unwrapCommaExpr(expr)
    if (ts.isIdentifier(u) && evalNames.has(u.text)) return true
    const info = getPropertyAccessInfo(u)
    return info !== null && info.name === 'eval' && isGlobalObjExpr(info.receiver)
  }

  const isGetBuiltinModuleCallee = (expr: ts.Expression): boolean => {
    const u = unwrapCommaExpr(expr)
    if (ts.isIdentifier(u) && getBuiltinModuleNames.has(u.text)) return true
    return getPropertyAccessName(u) === 'getBuiltinModule'
  }

  const isCreateRequireCallee = (expr: ts.Expression): boolean => {
    const u = unwrapCommaExpr(expr)
    if (ts.isIdentifier(u) && createRequireNames.has(u.text)) return true
    return getPropertyAccessName(u) === 'createRequire'
  }

  const isRequireCallee = (expr: ts.Expression): 'require' | 'create-require' | null => {
    const u = unwrapCommaExpr(expr)
    if (ts.isCallExpression(u) && isCreateRequireCallee(u.expression)) {
      return 'create-require'
    }
    if (ts.isIdentifier(u) && requireNames.has(u.text)) {
      return u.text === 'require' ? 'require' : 'create-require'
    }
    if (getPropertyAccessName(u) === 'require') {
      return 'require'
    }
    return null
  }

  for (const ref of sf.referencedFiles) {
    const line = sf.getLineAndCharacterOfPosition(ref.pos).line + 1
    edges.push({
      specifier: ref.fileName,
      kind: 'type-only',
      syntax: 'triple-slash-ref',
      line,
    })
  }

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) {
      const lit = extractStaticString(node.moduleSpecifier)
      const line = lineOf(sf, node)
      if (lit === null) {
        opaques.push({
          kind: 'import-nonliteral',
          text: node.getText(sf),
          line,
        })
      } else {
        const clause = node.importClause
        let kind: AstImportEdgeKind = 'value'
        if (clause !== undefined) {
          if (clause.isTypeOnly) {
            kind = 'type-only'
          } else if (
            clause.name === undefined &&
            clause.namedBindings !== undefined &&
            ts.isNamedImports(clause.namedBindings) &&
            clause.namedBindings.elements.length > 0 &&
            clause.namedBindings.elements.every((el) => el.isTypeOnly)
          ) {
            kind = 'type-only'
          }
        }
        edges.push({
          specifier: lit.value,
          kind,
          syntax: 'import',
          line,
        })
      }
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier !== undefined) {
      const lit = extractStaticString(node.moduleSpecifier)
      const line = lineOf(sf, node)
      if (lit === null) {
        opaques.push({
          kind: 'export-nonliteral',
          text: node.getText(sf),
          line,
        })
      } else {
        let kind: AstImportEdgeKind = 'value'
        if (node.isTypeOnly) {
          kind = 'type-only'
        } else if (
          node.exportClause !== undefined &&
          ts.isNamedExports(node.exportClause) &&
          node.exportClause.elements.length > 0 &&
          node.exportClause.elements.every((el) => el.isTypeOnly)
        ) {
          kind = 'type-only'
        }
        edges.push({
          specifier: lit.value,
          kind,
          syntax: 'export-from',
          line,
        })
      }
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      const lit = extractStaticString(node.moduleReference.expression)
      const line = lineOf(sf, node)
      if (lit === null) {
        opaques.push({
          kind: 'import-equals-nonliteral',
          text: node.getText(sf),
          line,
        })
      } else {
        edges.push({
          specifier: lit.value,
          kind: node.isTypeOnly ? 'type-only' : 'value',
          syntax: 'import-equals',
          line,
        })
      }
    } else if (ts.isModuleDeclaration(node) && ts.isStringLiteral(node.name)) {
      edges.push({
        specifier: node.name.text,
        kind: 'type-only',
        syntax: 'declare-module',
        line: lineOf(sf, node),
      })
    } else if (ts.isImportTypeNode(node)) {
      const line = lineOf(sf, node)
      if (ts.isLiteralTypeNode(node.argument)) {
        const arg = node.argument.literal
        if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) {
          edges.push({
            specifier: arg.text,
            kind: 'type-only',
            syntax: 'import-type',
            line,
          })
        } else {
          opaques.push({
            kind: 'import-type-nonliteral',
            text: node.getText(sf),
            line,
          })
        }
      } else {
        opaques.push({
          kind: 'import-type-nonliteral',
          text: node.getText(sf),
          line,
        })
      }
    } else if (ts.isCallExpression(node)) {
      const callee = unwrapValueExpr(node.expression)
      const line = lineOf(sf, node)
      const calleePropInfo = getPropertyAccessInfo(callee)

      if (callee.kind === ts.SyntaxKind.ImportKeyword) {
        const lit = extractStaticString(node.arguments[0])
        if (lit === null) {
          opaques.push({
            kind: 'dynamic-import-nonliteral',
            text: node.getText(sf),
            line,
          })
        } else {
          edges.push({
            specifier: lit.value,
            kind: 'value',
            syntax: lit.isTemplate ? 'dynamic-import-template' : 'dynamic-import',
            line,
          })
        }
      } else if (isCreateRequireCallee(callee)) {
        if (!isImmediateCallExpressionTarget(node) && !isSimpleVarDeclInitializer(node)) {
          opaques.push({
            kind: 'create-require-untracked',
            text: node.getText(sf),
            line,
          })
        }
      } else {
        const reqKind = isRequireCallee(callee)
        if (reqKind !== null) {
          const lit = extractStaticString(node.arguments[0])
          if (lit === null) {
            opaques.push({
              kind: 'require-nonliteral',
              text: node.getText(sf),
              line,
            })
          } else {
            edges.push({
              specifier: lit.value,
              kind: 'value',
              syntax: reqKind,
              line,
            })
          }
        } else if (
          calleePropInfo !== null &&
          calleePropInfo.name === 'parse' &&
          isUrlConstructorExpr(calleePropInfo.receiver) &&
          node.arguments.length >= 2 &&
          containsImportMetaRef(node.arguments[1]!, importMetaUrlVars)
        ) {
          opaques.push({
            kind: 'new-url-import-meta',
            text: node.getText(sf),
            line,
          })
        } else if (
          calleePropInfo !== null &&
          calleePropInfo.name === 'construct' &&
          node.arguments.length >= 1 &&
          isFunctionConstructorExpr(node.arguments[0]!)
        ) {
          opaques.push({
            kind: 'dynamic-eval-or-builtin',
            text: node.getText(sf),
            line,
          })
        } else if (
          calleePropInfo !== null &&
          calleePropInfo.name === 'construct' &&
          node.arguments.length >= 2 &&
          isUrlConstructorExpr(node.arguments[0]!) &&
          containsImportMetaRef(node.arguments[1]!, importMetaUrlVars)
        ) {
          opaques.push({
            kind: 'new-url-import-meta',
            text: node.getText(sf),
            line,
          })
        } else if (
          isEvalCalleeExpr(callee) ||
          isFunctionConstructorExpr(callee) ||
          isGetBuiltinModuleCallee(callee) ||
          (calleePropInfo !== null && calleePropInfo.name === 'constructor')
        ) {
          opaques.push({
            kind: 'dynamic-eval-or-builtin',
            text: node.getText(sf),
            line,
          })
        }
      }
    } else if (ts.isNewExpression(node)) {
      const line = lineOf(sf, node)
      if (
        isUrlConstructorExpr(node.expression) &&
        node.arguments !== undefined &&
        node.arguments.length >= 2 &&
        containsImportMetaRef(node.arguments[1]!, importMetaUrlVars)
      ) {
        opaques.push({
          kind: 'new-url-import-meta',
          text: node.getText(sf),
          line,
        })
      } else if (
        isFunctionConstructorExpr(node.expression) ||
        getPropertyAccessName(node.expression) === 'constructor'
      ) {
        opaques.push({
          kind: 'dynamic-eval-or-builtin',
          text: node.getText(sf),
          line,
        })
      }
    } else if (isImportMetaExpr(node) && !isInsideTypeContext(node)) {
      if (!isHandledImportMetaUsage(node)) {
        opaques.push({
          kind: 'import-meta-loader',
          text: node.getText(sf),
          line: lineOf(sf, node),
        })
      }
    } else if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const line = lineOf(sf, node)
      const recv = node.expression
      const propName = ts.isPropertyAccessExpression(node)
        ? node.name.text
        : extractPropertyKeyString(node.argumentExpression)

      if (isImportMetaOrAlias(recv)) {
        if (ts.isElementAccessExpression(node) || (propName !== null && IMPORT_META_LOADER_PROPS.has(propName))) {
          opaques.push({
            kind: 'import-meta-loader',
            text: node.getText(sf),
            line,
          })
        }
      } else if (
        propName === 'constructor' &&
        (ts.isArrowFunction(unwrapCommaExpr(recv)) || ts.isFunctionExpression(unwrapCommaExpr(recv)))
      ) {
        opaques.push({
          kind: 'dynamic-eval-or-builtin',
          text: node.getText(sf),
          line,
        })
      } else if (!isInsideTypeContext(node) && propName !== null) {
        if (propName === 'require' && isGlobalObjExpr(recv)) {
          if (!isHandledLoaderUsage(node, true, false)) {
            opaques.push({
              kind: 'require-nonliteral',
              text: node.getText(sf),
              line,
            })
          }
        } else if (
          propName === 'createRequire' &&
          (isGlobalObjExpr(recv) || isModuleNsExpr(recv))
        ) {
          if (!isHandledLoaderUsage(node, true, false)) {
            opaques.push({
              kind: 'create-require-untracked',
              text: node.getText(sf),
              line,
            })
          }
        } else if (propName === 'eval' && isGlobalObjExpr(recv)) {
          if (!isHandledLoaderUsage(node, false, false)) {
            opaques.push({
              kind: 'dynamic-eval-or-builtin',
              text: node.getText(sf),
              line,
            })
          }
        } else if (propName === 'Function' && isGlobalObjExpr(recv)) {
          if (!isHandledLoaderUsage(node, false, true)) {
            opaques.push({
              kind: 'dynamic-eval-or-builtin',
              text: node.getText(sf),
              line,
            })
          }
        } else if (
          propName === 'getBuiltinModule' &&
          (isProcessExpr(recv) || isGlobalObjExpr(recv))
        ) {
          if (!isHandledLoaderUsage(node, false, false)) {
            opaques.push({
              kind: 'dynamic-eval-or-builtin',
              text: node.getText(sf),
              line,
            })
          }
        }
      }
    } else if (
      ts.isVariableDeclaration(node) &&
      node.initializer !== undefined &&
      isImportMetaOrAlias(node.initializer) &&
      ts.isObjectBindingPattern(node.name)
    ) {
      for (const el of node.name.elements) {
        const orig =
          el.propertyName !== undefined && ts.isIdentifier(el.propertyName)
            ? el.propertyName.text
            : el.propertyName !== undefined && ts.isStringLiteral(el.propertyName)
              ? el.propertyName.text
              : ts.isIdentifier(el.name)
                ? el.name.text
                : null
        if (
          (orig !== null && IMPORT_META_LOADER_PROPS.has(orig)) ||
          (el.propertyName !== undefined && ts.isComputedPropertyName(el.propertyName))
        ) {
          opaques.push({
            kind: 'import-meta-loader',
            text: node.getText(sf),
            line: lineOf(sf, node),
          })
          break
        }
      }
    } else if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isObjectLiteralExpression(node.left) &&
      isImportMetaOrAlias(node.right)
    ) {
      for (const prop of node.left.properties) {
        const nameNode = prop.name
        const orig =
          nameNode !== undefined && (ts.isIdentifier(nameNode) || ts.isStringLiteral(nameNode))
            ? nameNode.text
            : null
        if (
          (orig !== null && IMPORT_META_LOADER_PROPS.has(orig)) ||
          (nameNode !== undefined && ts.isComputedPropertyName(nameNode))
        ) {
          opaques.push({
            kind: 'import-meta-loader',
            text: node.getText(sf),
            line: lineOf(sf, node),
          })
          break
        }
      }
    } else if (ts.isIdentifier(node) && !isNonValueIdentifierPosition(node)) {
      const name = node.text
      const line = lineOf(sf, node)
      if (requireNames.has(name)) {
        if (!isHandledLoaderUsage(node, true, false)) {
          opaques.push({
            kind: 'require-nonliteral',
            text: node.getText(sf),
            line,
          })
        }
      } else if (createRequireNames.has(name)) {
        if (!isHandledLoaderUsage(node, true, false)) {
          opaques.push({
            kind: 'create-require-untracked',
            text: node.getText(sf),
            line,
          })
        }
      } else if (evalNames.has(name) || getBuiltinModuleNames.has(name)) {
        if (!isHandledLoaderUsage(node, false, false)) {
          opaques.push({
            kind: 'dynamic-eval-or-builtin',
            text: node.getText(sf),
            line,
          })
        }
      } else if (functionCtorNames.has(name)) {
        if (!isHandledLoaderUsage(node, false, true)) {
          opaques.push({
            kind: 'dynamic-eval-or-builtin',
            text: node.getText(sf),
            line,
          })
        }
      } else if (importMetaVars.has(name)) {
        if (!isHandledImportMetaUsage(node)) {
          opaques.push({
            kind: 'import-meta-loader',
            text: node.getText(sf),
            line,
          })
        }
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sf)
  return { edges, opaques }
}

function resolveLocalSpecifier(
  repoRootAbs: string,
  fromAbs: string,
  specifier: string,
  host: AstImportGraphHost,
): { readonly kind: 'resolved'; readonly relPath: string } | { readonly kind: 'out-of-repo' } | { readonly kind: 'unresolved' } {
  const clean = specifier.split(/[?#]/, 1)[0]!
  const baseAbs = clean.startsWith('/')
    ? resolve(repoRootAbs, clean.slice(1))
    : resolve(dirname(fromAbs), clean)

  const candidates: string[] = [baseAbs]
  const ext = extname(baseAbs).toLowerCase()
  if (ext === '.js') {
    const stem = baseAbs.slice(0, -3)
    candidates.push(`${stem}.ts`, `${stem}.tsx`, `${stem}.mts`)
  } else if (ext === '.mjs') {
    const stem = baseAbs.slice(0, -4)
    candidates.push(`${stem}.mts`, `${stem}.ts`)
  } else if (ext === '.cjs') {
    const stem = baseAbs.slice(0, -4)
    candidates.push(`${stem}.cts`, `${stem}.ts`)
  } else if (ext === '.jsx') {
    const stem = baseAbs.slice(0, -4)
    candidates.push(`${stem}.tsx`, `${stem}.ts`)
  } else if (ext === '') {
    candidates.push(
      `${baseAbs}.ts`,
      `${baseAbs}.tsx`,
      `${baseAbs}.mts`,
      `${baseAbs}.cts`,
      `${baseAbs}.d.ts`,
      `${baseAbs}.js`,
      `${baseAbs}.mjs`,
      `${baseAbs}.cjs`,
      `${baseAbs}.json`,
      join(baseAbs, 'index.ts'),
      join(baseAbs, 'index.tsx'),
      join(baseAbs, 'index.mts'),
      join(baseAbs, 'index.d.ts'),
      join(baseAbs, 'index.js'),
    )
  }

  const checkOutside = (absTarget: string): boolean => {
    const rel = toPosix(relative(repoRootAbs, absTarget))
    return rel === '..' || rel.startsWith('../')
  }

  for (const cand of candidates) {
    if (host.fileExists(cand)) {
      if (checkOutside(cand)) {
        return { kind: 'out-of-repo' }
      }
      return { kind: 'resolved', relPath: toPosix(relative(repoRootAbs, cand)) }
    }
  }

  if (checkOutside(baseAbs)) {
    return { kind: 'out-of-repo' }
  }
  return { kind: 'unresolved' }
}

export function collectAstImportGraph(
  repoRoot: string,
  entryRelPath: string,
  options: CollectAstImportGraphOptions = {},
): AstImportGraph {
  const repoRootAbs = resolve(repoRoot)
  const host = options.host ?? createFsHost()
  const parseCache = options.parseCache
  const entry = normalizeRelPath(repoRootAbs, entryRelPath)

  const stopAtSet = new Set<string>()
  if (options.stopAt !== undefined) {
    for (const s of options.stopAt) {
      stopAtSet.add(normalizeRelPath(repoRootAbs, s))
    }
  }

  const allFiles = new Set<string>([entry])
  const edges: AstImportEdge[] = []
  const packagesSet = new Set<string>()
  const opaques: OpaqueConstruct[] = []
  const unresolved: UnresolvedImport[] = []

  const queue: string[] = [entry]
  const expanded = new Set<string>()

  while (queue.length > 0) {
    const curRel = queue.shift()!
    if (expanded.has(curRel)) continue
    expanded.add(curRel)
    if (curRel !== entry && stopAtSet.has(curRel)) continue

    const curAbs = resolve(repoRootAbs, curRel)
    if (!host.fileExists(curAbs)) {
      throw new Error(`AST import graph entry/file not found: ${curRel}`)
    }

    const skipCache = host.isOverridden !== undefined && host.isOverridden(curAbs)
    let parsed: ParsedFileDependencies | undefined
    if (!skipCache && parseCache !== undefined) {
      parsed = parseCache.get(curAbs)
    }
    if (parsed === undefined) {
      const sourceText = host.readFile(curAbs)
      parsed = extractFileDependenciesAst(curAbs, sourceText)
      if (!skipCache && parseCache !== undefined) {
        parseCache.set(curAbs, parsed)
      }
    }

    for (const opq of parsed.opaques) {
      opaques.push({
        file: curRel,
        kind: opq.kind,
        text: opq.text,
        line: opq.line,
      })
    }

    for (const rawEdge of parsed.edges) {
      const spec = rawEdge.specifier.trim()
      if (spec.startsWith('file:')) {
        opaques.push({
          file: curRel,
          kind: 'file-url-import',
          text: spec,
          line: rawEdge.line,
        })
        continue
      }
      if (spec.startsWith('.') || spec.startsWith('/')) {
        const res = resolveLocalSpecifier(repoRootAbs, curAbs, spec, host)
        if (res.kind === 'out-of-repo') {
          opaques.push({
            file: curRel,
            kind: 'out-of-repo-import',
            text: spec,
            line: rawEdge.line,
          })
        } else if (res.kind === 'unresolved') {
          unresolved.push({
            file: curRel,
            specifier: spec,
            kind: rawEdge.kind,
            syntax: rawEdge.syntax,
            line: rawEdge.line,
          })
        } else {
          edges.push({
            from: curRel,
            to: res.relPath,
            specifier: spec,
            kind: rawEdge.kind,
            syntax: rawEdge.syntax,
            line: rawEdge.line,
          })
          if (!allFiles.has(res.relPath)) {
            allFiles.add(res.relPath)
            if (!stopAtSet.has(res.relPath)) {
              queue.push(res.relPath)
            }
          }
        }
      } else {
        packagesSet.add(spec)
      }
    }
  }

  // Pass B: value-only BFS from entry (honoring stopAt)
  const valueEdgesByFrom = new Map<string, string[]>()
  for (const edge of edges) {
    if (edge.kind !== 'value') continue
    let list = valueEdgesByFrom.get(edge.from)
    if (list === undefined) {
      list = []
      valueEdgesByFrom.set(edge.from, list)
    }
    list.push(edge.to)
  }

  const valueReachable = new Set<string>([entry])
  const valQueue: string[] = [entry]
  while (valQueue.length > 0) {
    const cur = valQueue.shift()!
    if (cur !== entry && stopAtSet.has(cur)) continue
    const nexts = valueEdgesByFrom.get(cur)
    if (nexts === undefined) continue
    for (const next of nexts) {
      if (!valueReachable.has(next)) {
        valueReachable.add(next)
        if (!stopAtSet.has(next)) {
          valQueue.push(next)
        }
      }
    }
  }

  const typeOnlyReachable = new Set<string>()
  for (const file of allFiles) {
    if (!valueReachable.has(file)) {
      typeOnlyReachable.add(file)
    }
  }

  const directValSet = new Set<string>()
  const directAnySet = new Set<string>()
  for (const edge of edges) {
    if (edge.from !== entry) continue
    directAnySet.add(edge.to)
    if (edge.kind === 'value') {
      directValSet.add(edge.to)
    }
  }
  const directTypeOnlySet = new Set<string>()
  for (const target of directAnySet) {
    if (!directValSet.has(target)) {
      directTypeOnlySet.add(target)
    }
  }

  return {
    entry,
    allFiles,
    valueReachable,
    typeOnlyReachable,
    directValueFiles: [...directValSet].sort(),
    directTypeOnlyFiles: [...directTypeOnlySet].sort(),
    edges,
    packages: [...packagesSet].sort(),
    opaques,
    unresolved,
  }
}

export function formatShortestImportChain(
  graph: AstImportGraph,
  target: string,
  valueOnly = false,
): string {
  if (target === graph.entry) return graph.entry
  const adj = new Map<string, AstImportEdge[]>()
  for (const edge of graph.edges) {
    if (valueOnly && edge.kind !== 'value') continue
    let list = adj.get(edge.from)
    if (list === undefined) {
      list = []
      adj.set(edge.from, list)
    }
    list.push(edge)
  }

  const parent = new Map<string, { readonly prev: string; readonly edge: AstImportEdge }>()
  const visited = new Set<string>([graph.entry])
  const queue: string[] = [graph.entry]

  while (queue.length > 0) {
    const cur = queue.shift()!
    const outgoing = adj.get(cur)
    if (outgoing === undefined) continue
    for (const edge of outgoing) {
      if (visited.has(edge.to)) continue
      visited.add(edge.to)
      parent.set(edge.to, { prev: cur, edge })
      if (edge.to === target) {
        const parts: string[] = [target]
        let back = target
        while (back !== graph.entry) {
          const step = parent.get(back)!
          parts.push(`${step.prev}:${step.edge.line}[${step.edge.kind}/${step.edge.syntax}]`)
          back = step.prev
        }
        return parts.reverse().join(' -> ')
      }
      queue.push(edge.to)
    }
  }
  return `${graph.entry} -/-> ${target}`
}

function setDiffSorted(actual: readonly string[], expected: readonly string[]): string[] {
  const expSet = new Set(expected)
  return actual.filter((x) => !expSet.has(x)).sort()
}

export function evaluateLegacyImportGate(
  graph: AstImportGraph,
  policy: LegacyImportGatePolicy,
): LegacyImportGateReport {
  const legacyPrefixes = policy.legacyPrefixes ?? DEFAULT_LEGACY_PREFIXES
  const allowedRootPrefixes = policy.allowedRootPrefixes ?? DEFAULT_ALLOWED_ROOT_PREFIXES
  const exemptSet = new Set<string>([graph.entry, ...(policy.exemptFiles ?? [])])

  const isLegacy = (f: string): boolean =>
    !exemptSet.has(f) && legacyPrefixes.some((prefix) => f.startsWith(prefix))

  const directLegacyValue = graph.directValueFiles.filter(isLegacy).sort()
  const directLegacyTypeOnly = graph.directTypeOnlyFiles.filter(isLegacy).sort()
  const transitiveLegacyValue = [...graph.valueReachable].filter(isLegacy).sort()
  const transitiveLegacyTypeOnly = [...graph.typeOnlyReachable].filter(isLegacy).sort()

  const nonItemsServerFiles = [...graph.allFiles]
    .filter((f) => !exemptSet.has(f) && f.startsWith('src/server/') && !f.startsWith('src/server/items/'))
    .sort()

  const outsideAllowedRoots = [...graph.allFiles]
    .filter(
      (f) => !exemptSet.has(f) && !allowedRootPrefixes.some((prefix) => f.startsWith(prefix)),
    )
    .sort()

  const directValSet = new Set(graph.directValueFiles)
  const directTypeSet = new Set(graph.directTypeOnlyFiles)
  const namedFileStatuses: Record<string, NamedFileStatus> = {}
  for (const f of policy.namedFiles ?? []) {
    const direct: ReachabilityStatus = directValSet.has(f)
      ? 'value'
      : directTypeSet.has(f)
        ? 'type-only'
        : 'none'
    const transitive: ReachabilityStatus = graph.valueReachable.has(f)
      ? 'value'
      : graph.typeOnlyReachable.has(f)
        ? 'type-only'
        : 'none'
    namedFileStatuses[f] = {
      file: f,
      direct,
      transitive,
      chain:
        transitive === 'none'
          ? null
          : formatShortestImportChain(graph, f, transitive === 'value'),
    }
  }

  const unexpectedDirectValue = setDiffSorted(directLegacyValue, policy.allowedDirectValue)
  const staleDirectValue = setDiffSorted(policy.allowedDirectValue, directLegacyValue)
  const unexpectedDirectTypeOnly = setDiffSorted(directLegacyTypeOnly, policy.allowedDirectTypeOnly)
  const staleDirectTypeOnly = setDiffSorted(policy.allowedDirectTypeOnly, directLegacyTypeOnly)
  const unexpectedTransitiveValue = setDiffSorted(
    transitiveLegacyValue,
    policy.allowedTransitiveValue,
  )
  const staleTransitiveValue = setDiffSorted(policy.allowedTransitiveValue, transitiveLegacyValue)
  const unexpectedTransitiveTypeOnly = setDiffSorted(
    transitiveLegacyTypeOnly,
    policy.allowedTransitiveTypeOnly,
  )
  const staleTransitiveTypeOnly = setDiffSorted(
    policy.allowedTransitiveTypeOnly,
    transitiveLegacyTypeOnly,
  )

  const violations: string[] = []
  for (const opq of graph.opaques) {
    violations.push(`opaque[${opq.kind}] at ${opq.file}:${opq.line}: ${opq.text}`)
  }
  for (const unres of graph.unresolved) {
    violations.push(
      `unresolved[${unres.kind}/${unres.syntax}] at ${unres.file}:${unres.line}: ${unres.specifier}`,
    )
  }
  for (const pkg of graph.packages) {
    violations.push(`bare-package: ${pkg}`)
  }
  for (const f of outsideAllowedRoots) {
    violations.push(`outside-allowed-roots: ${f} (${formatShortestImportChain(graph, f)})`)
  }
  if (policy.forbidNonItemsServer === true) {
    for (const f of nonItemsServerFiles) {
      violations.push(`forbidden-non-items-server: ${f} (${formatShortestImportChain(graph, f)})`)
    }
  }
  for (const f of unexpectedDirectValue) {
    violations.push(`unexpected-direct-value: ${f} (${formatShortestImportChain(graph, f, true)})`)
  }
  for (const f of staleDirectValue) {
    violations.push(`stale-direct-value-allowlist: ${f}`)
  }
  for (const f of unexpectedDirectTypeOnly) {
    violations.push(`unexpected-direct-type-only: ${f} (${formatShortestImportChain(graph, f)})`)
  }
  for (const f of staleDirectTypeOnly) {
    violations.push(`stale-direct-type-only-allowlist: ${f}`)
  }
  for (const f of unexpectedTransitiveValue) {
    violations.push(
      `unexpected-transitive-value: ${f} (${formatShortestImportChain(graph, f, true)})`,
    )
  }
  for (const f of staleTransitiveValue) {
    violations.push(`stale-transitive-value-allowlist: ${f}`)
  }
  for (const f of unexpectedTransitiveTypeOnly) {
    violations.push(
      `unexpected-transitive-type-only: ${f} (${formatShortestImportChain(graph, f)})`,
    )
  }
  for (const f of staleTransitiveTypeOnly) {
    violations.push(`stale-transitive-type-only-allowlist: ${f}`)
  }

  return {
    ok: violations.length === 0,
    directLegacyValue,
    directLegacyTypeOnly,
    transitiveLegacyValue,
    transitiveLegacyTypeOnly,
    nonItemsServerFiles,
    outsideAllowedRoots,
    namedFileStatuses,
    unexpectedDirectValue,
    staleDirectValue,
    unexpectedDirectTypeOnly,
    staleDirectTypeOnly,
    unexpectedTransitiveValue,
    staleTransitiveValue,
    unexpectedTransitiveTypeOnly,
    staleTransitiveTypeOnly,
    violations,
  }
}
