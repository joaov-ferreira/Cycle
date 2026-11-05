/**
 * Static check behind `src/i18n/no-hardcoded-strings.test.ts` (SPEC §11.1, AGENTS.md): finds
 * user-facing string literals that bypass the i18n layer in TSX source.
 *
 * Flagged: JSX text; string/template literals rendered as the child of an element
 * (`<Text>{'Save'}</Text>`); and string literals given to accessibility/label-like props
 * (`accessibilityLabel="Save"`). A literal is only user-facing when it contains a letter, so
 * separators (`·`, `—`) and numbers are fine.
 */
import ts from 'typescript';

export type HardcodedText = { line: number; text: string; kind: 'jsx-text' | 'child-literal' | 'prop' };

const TEXT_PROPS = new Set([
  'accessibilityLabel',
  'accessibilityHint',
  'accessibilityValue',
  'label',
  'title',
  'placeholder',
  'hint',
  'alt',
]);

const hasLetter = (text: string) => /\p{L}/u.test(text);

export function findHardcodedText(source: string, fileName = 'file.tsx'): HardcodedText[] {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: HardcodedText[] = [];
  const add = (node: ts.Node, text: string, kind: HardcodedText['kind']) => {
    const { line } = file.getLineAndCharacterOfPosition(node.getStart(file));
    found.push({ line: line + 1, text: text.trim(), kind });
  };

  const literalText = (node: ts.Expression): string | null => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (ts.isTemplateExpression(node)) {
      const parts = [node.head.text, ...node.templateSpans.map((span) => span.literal.text)];
      return parts.join('');
    }
    return null;
  };

  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node) && hasLetter(node.text)) add(node, node.text, 'jsx-text');
    if (ts.isJsxExpression(node) && node.expression && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) {
      const text = literalText(node.expression);
      if (text !== null && hasLetter(text)) add(node, text, 'child-literal');
    }
    if (ts.isJsxAttribute(node) && TEXT_PROPS.has(node.name.getText(file)) && node.initializer) {
      const init = node.initializer;
      const expression = ts.isJsxExpression(init) ? init.expression : init;
      const text = expression && (ts.isStringLiteral(expression) || ts.isExpression(expression)) ? literalText(expression as ts.Expression) : null;
      if (text !== null && hasLetter(text)) add(node, text, 'prop');
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}
