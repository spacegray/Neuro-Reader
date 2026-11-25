import {index,integer,primaryKey,sqliteTable,text,uniqueIndex} from "drizzle-orm/sqlite-core";

export const moderationContacts=sqliteTable("moderation_contacts",{
  subject:text("subject").notNull(), emailKey:text("email_key").notNull()
},t=>[primaryKey({columns:[t.subject,t.emailKey]}),index("mod_email").on(t.emailKey)]);
export const moderationReports=sqliteTable("moderation_reports",{
  id:text("id").primaryKey(), subject:text("subject").notNull(), reason:text("reason").notNull(),
  confidence:integer("confidence").notNull(), strike:integer("strike").notNull(), created:integer("created").notNull(),
  bucket:integer("bucket").notNull(), attempts:integer("attempts").notNull().default(1)
},t=>[uniqueIndex("mod_report_dedup").on(t.subject,t.reason,t.bucket),index("mod_report_time").on(t.created),index("mod_subject_date").on(t.subject,t.created)]);
export const moderationBlocks=sqliteTable("moderation_blocks",{
  subject:text("subject").primaryKey(), blockedAt:integer("blocked_at").notNull(), releasedAt:integer("released_at"),
});
export const moderationAppeals=sqliteTable("moderation_appeals",{
  id:text("id").primaryKey(), subject:text("subject").notNull(), blockSubject:text("block_subject").notNull(),
  message:text("message").notNull(), documentation:text("documentation").notNull(), created:integer("created").notNull(),
  reviewed:integer("reviewed"), status:text("status").notNull().default("pending"), day:integer("day").notNull()
},t=>[uniqueIndex("mod_appeal_day").on(t.subject,t.day),index("mod_appeal_created").on(t.created)]);
