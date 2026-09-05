# The Learning System

## How Every Session Works

1. **Start**: Open a new Claude conversation. Type `@CONTEXT.md` — this gives Claude your full context instantly. No re-explaining.
2. **Work**: Run the current notebook. Complete every challenge cell before moving on.
3. **End**: Tell Claude what you completed and what was hard. Claude updates `CONTEXT.md`.
4. **Next session**: Repeat from step 1.

---

## How Every Notebook Works

Each notebook follows a fixed 5-step loop:

```
CONCEPT   → Read the markdown. Understand the idea.
CODE      → Run the example. Change one thing. See what happens.
CHALLENGE → Solve the problem. Modify the code yourself.
ASSERT    → Run the assert cell. It tells you if you got it right.
REFLECT   → Fill in the comment. Explain it in your own words.
```

**The assert cell is the safeguard.** If it fails, go back and fix the challenge. Do not skip it.

**The reflect comment is mandatory.** If you can't explain it, you don't understand it yet. That's fine — ask Claude.

---

## How to Ask Claude for Help (Token-Efficient)

Don't describe your situation from scratch. Just say:

> "@CONTEXT.md — stuck on [notebook X, challenge Y]. Here's my code: [paste cell]"

Claude will know your full context from the file.

---

## Curriculum Status

| Notebook | Topic | Status |
|---|---|---|
| 01 | Distributions & Probability | ✅ Complete |
| 02 | Bayesian Thinking | 🟡 In Progress |
| 03 | Time Series & Volatility | 🔲 Not Started |

---

## Safeguards

- **Do not skip challenge cells.** The assert exists to catch wrong answers.
- **Do not move to the next notebook until the recap table makes sense.** If any row in the recap feels fuzzy, ask Claude before moving on.
- **Update CONTEXT.md after every session.** A skipped update breaks the memory system.
