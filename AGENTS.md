# Rules
- Always use context7 / webfetch to research opencode docs at https://opencode.ai/docs before planning or implementating changes.
- Research other people's implementation of plugins on https://github.com/awesome-opencode/awesome-opencode for best practices, but prefer the ones with more stars. Find problems they might have run into so you don't run into them yourself.
- Create unit / integration tests for your changes.
- Ensure code is SOLID, DRY, modular, and maintainable.
- Keep I/O, infrastructure, and heavy external dependencies at the edge, heavy logic should be easily unit testable. Adhere to hexagonal design principles.
- Prefer refactoring code to improve testability over using mocks. Mocks should be minimal.
- Research libraries that have already solved your particular problem before attempting to write your own implementation.
- Always prefer asking questions for clarity over attempting to solve a problem you have low confidence in. Before doing so, ensure your question is well-formed by researching beforehand. If research sufficiently addresses the inquiry, you can proceed with implementation.
