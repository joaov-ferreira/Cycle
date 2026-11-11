/// <reference types="node" />
import fs from 'fs';
import path from 'path';

import { findHardcodedText } from '@/test-utils/find-hardcoded-text';

const SRC = path.resolve(__dirname, '..');
const SCANNED_DIRS = ['app', 'components'];

function tsxFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return tsxFiles(full);
    return /\.tsx$/.test(entry.name) && !/\.test\.tsx$/.test(entry.name) ? [full] : [];
  });
}

describe('findHardcodedText', () => {
  it('flags JSX text, literal children and literal label props', () => {
    const source = [
      'export const A = () => (',
      '  <View>',
      '    <Text>Save</Text>',
      "    <Text>{'Cancel'}</Text>",
      '    <Text>{`Total ${n}`}</Text>',
      '    <Button label="Go" accessibilityLabel={"Go now"} />',
      '    <TextField placeholder="Name" />',
      '  </View>',
      ');',
    ].join('\n');
    expect(findHardcodedText(source).map(({ line, text, kind }) => [line, text, kind])).toEqual([
      [3, 'Save', 'jsx-text'],
      [4, 'Cancel', 'child-literal'],
      [5, 'Total', 'child-literal'],
      [6, 'Go', 'prop'],
      [6, 'Go now', 'prop'],
      [7, 'Name', 'prop'],
    ]);
  });

  it('accepts translated text, numbers and separators', () => {
    const source = [
      'export const A = () => (',
      '  <View>',
      "    <Text>{t('a.b')}</Text>",
      '    <Text> · </Text>',
      '    <Text>{`${a} — ${b}`}</Text>',
      "    <Text>{'—'}</Text>",
      '    <Text>{value}</Text>',
      "    <Button label={t('a.b')} accessibilityLabel={label} testID=\"save-button\" />",
      '  </View>',
      ');',
    ].join('\n');
    expect(findHardcodedText(source)).toEqual([]);
  });
});

describe('UI sources', () => {
  const files = SCANNED_DIRS.flatMap((dir) => tsxFiles(path.join(SRC, dir)));

  it('scans the app and component sources', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('render no string literal directly: every user-facing string goes through t()', () => {
    const offenders = files.flatMap((file) =>
      findHardcodedText(fs.readFileSync(file, 'utf8'), file).map(
        ({ line, text, kind }) => `${path.relative(SRC, file)}:${line} ${kind} "${text}"`,
      ),
    );
    expect(offenders).toEqual([]);
  });
});
