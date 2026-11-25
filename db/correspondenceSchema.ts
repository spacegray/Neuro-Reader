import {index,integer,sqliteTable,text} from "drizzle-orm/sqlite-core";

export const accountFeedback=sqliteTable("account_feedback",{
  id:text("id").primaryKey(),
  subject:text("subject").notNull(),
  message:text("message").notNull(),
  created:integer("created").notNull(),
  delivery:text("delivery").notNull().default("inbox"),
},t=>[index("feedback_owner_time").on(t.subject,t.created),index("feedback_created").on(t.created)]);

// A closure receipt also prevents stale devices from recreating an erased profile.
export const accountClosures=sqliteTable("account_closures",{
  subject:text("subject").primaryKey(),
  id:text("id").notNull().unique(),
  created:integer("created").notNull(),
  delivery:text("delivery").notNull().default("inbox"),
},t=>[index("closure_created").on(t.created)]);
