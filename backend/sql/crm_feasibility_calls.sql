-- Feasibility-call drafts/submissions for the CRM.
--
-- This table is NOT part of the base `acquirewc_dev` dump, so create it once
-- against the `sales_billing` database after restoring the dump. It follows the
-- same `<table>_id` primary-key convention as the rest of the schema and is the
-- table the SQLAlchemy model `app.models.CrmFeasibilityCall` maps onto.
--
-- Safe to re-run: it only creates the table if it does not already exist. If an
-- older table with different columns exists, drop it first:
--   DROP TABLE IF EXISTS `crm_feasibility_calls`;

CREATE TABLE IF NOT EXISTS `crm_feasibility_calls` (
  `crm_feasibility_call_id` int NOT NULL AUTO_INCREMENT,
  `crm_leads_id` int NOT NULL,
  `call_setup` json NOT NULL,
  `components` json NOT NULL,
  `generated_output` json DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'draft',
  `current_step` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`crm_feasibility_call_id`),
  KEY `idx_crm_feasibility_call_lead` (`crm_leads_id`),
  CONSTRAINT `crm_feasibility_calls_ibfk_1`
    FOREIGN KEY (`crm_leads_id`) REFERENCES `crm_leads` (`crm_lead_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
