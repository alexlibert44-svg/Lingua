---
name: Zod codegen compatibility
description: The current Orval Zod generator emits Zod 4 APIs for integer schemas.
---

Use Zod 4 across the workspace when regenerating API schemas that contain OpenAPI integer fields.

**Why:** The current Orval output uses `z.int()`, which does not exist in the workspace's older Zod 3 runtime.

**How to apply:** Keep the workspace Zod catalog on a Zod 4 release and run a full library typecheck after OpenAPI codegen.