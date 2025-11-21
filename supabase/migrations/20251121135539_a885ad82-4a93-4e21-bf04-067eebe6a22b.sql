-- Add column for custom LLM configuration to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS llm_system_prompt TEXT DEFAULT NULL;

COMMENT ON COLUMN projects.llm_system_prompt IS 'Custom system prompt for LLM interactions';