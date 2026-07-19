# Shared contracts

Mrigesh owns this integration seam. Canonical Pydantic models export JSON
Schema here, and TypeScript types are generated from those schemas.

Consumers must import generated types and validate fixtures; never hand-edit
generated files or introduce a competing local contract. See the root
`AGENTS.md` for the contract-change and review workflow.
