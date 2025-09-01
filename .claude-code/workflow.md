# Claude Code Workflow

## Process Overview
1. Before starting: Update claude_log.md with INTERPRET section
2. During work: Log decisions in SELECT and REFINE sections
3. After implementation: Document changes in IMPLEMENT section
4. Before commit: Use COMMIT section to generate git message

## Log Template
Each work session should follow this structure in claude_log.md:

### INTERPRET
**Task**: [What was requested]
**Context**: [Current state, constraints, requirements]
**Acceptance Criteria**: [How to know it's done]

### SELECT
**Approach**: [Chosen strategy/method]
**Alternatives Considered**: [What else was considered and why rejected]
**Tools/Libraries**: [Dependencies, frameworks used]

### REFINE
**Iterations**: 
- V1: [First attempt, what worked/didn't]
- V2: [Refinements made]
- V3: [Final approach]

### IMPLEMENT
**Files Changed**:
- `path/to/file.js`: [Brief description of changes]
- `path/to/test.js`: [Test additions]

**Key Code Changes**:
```language
// Brief code snippets or descriptions

## Commit Message Generation
From claude_log.md COMMIT section:
- First line → git commit summary (50 chars max)
- Details → git commit body
- Include co-author: `Co-authored-by: Claude Code <claude@anthropic.com>`
