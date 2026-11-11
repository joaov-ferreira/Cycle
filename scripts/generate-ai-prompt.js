// Regenerates docs/AI_PLAN_PROMPT.md and docs/AI_PLAN_PROMPT.pt-BR.md (npm run docs:prompt).
// The documents are written by src/library/ai-prompt-docs.test.ts when UPDATE_AI_PROMPT_DOCS=1.
process.env.UPDATE_AI_PROMPT_DOCS = '1';

require('jest')
  .run(['src/library/ai-prompt-docs.test.ts'])
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
