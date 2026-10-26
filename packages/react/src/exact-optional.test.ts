import ts from 'typescript';
import { expect, it } from 'vitest';

/**
 * Consumers may compile with `exactOptionalPropertyTypes`, where an optional
 * property doesn't take `undefined` unless its type says so. This
 * repository's own code doesn't compile with it, so only the fixture is
 * checked, against the package's tsconfig with the option on.
 */
it('takes every kind of definition under exactOptionalPropertyTypes', ({
  task,
}) => {
  const fixture = task.file.filepath.replace(/\.test\.ts$/, '.fixture.ts');
  const config = ts.getParsedCommandLineOfConfigFile(
    ts.findConfigFile(fixture, ts.sys.fileExists)!,
    { exactOptionalPropertyTypes: true },
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
        throw new Error(
          ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
        );
      },
    },
  )!;
  const program = ts.createProgram([fixture], config.options);
  const diagnostics = ts.getPreEmitDiagnostics(
    program,
    program.getSourceFile(fixture),
  );
  expect(
    ts.formatDiagnostics(diagnostics, {
      getCanonicalFileName: (name) => name,
      getCurrentDirectory: ts.sys.getCurrentDirectory,
      getNewLine: () => '\n',
    }),
  ).toBe('');
}, 30_000);
