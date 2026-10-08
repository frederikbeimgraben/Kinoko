# Code and text rules

These rules apply to each file in the repository.

## Language of comments and documents

Write each comment, doc comment and document in ASD-STE100 Simplified
Technical English (STE).

- Use one instruction or one statement in each sentence.
- Use sentences of no more than 20 words. Use paragraphs of no more than six sentences.
- Use the active voice. Use the present tense for descriptions.
- Use the imperative for instructions: "Run the tests", not "You should run the tests".
- Use the approved meaning of a word. Use one word for one thing. For example, use "show" and not "display", "start" and not "launch", "use" and not "utilize".
- Do not use "-ing" forms as nouns or adjectives when another form is possible.
- Use technical names (for example, names of tables, types, endpoints) as they are in the code.
- Write user interface text in the text catalogue (`backend/daten/texte.json`), not in code. That text stays in German and English.

## Comments

A comment tells why. The code tells what.

- Do not write a comment that tells what the next line does.
- Do not write a comment that tells the history of the code: no dates, no PR numbers, no words such as "now", "before", "since" or "until".
- Write a doc comment for each exported item. Start it with the name of the item when the language expects it (Go).
- Keep a comment block to two lines or fewer. Keep a doc comment to three lines or fewer.

## Functional style

- Prefer pure functions: the same input gives the same output and changes nothing else.
- Prefer a pipeline of transformations (map, filter, reduce, iterators, `computed`) to a loop that changes state.
- Prefer values that do not change. Make a new value instead of a change to an old value.
- Keep side effects (database, network, files, timers) at the edge of a module.

## Frontend

- Keep state in stores (`@ngrx/signals`). A component reads signals and calls store methods.
- Do not subscribe by hand in a component. Use `computed`, `resource`, `rxMethod` or the `async` pipe.
- Give each loading state a skeleton with the shape of the real content.
- Give each change of view a transition. Respect `prefers-reduced-motion`.
