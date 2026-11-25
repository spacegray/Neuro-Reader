import {integer,sqliteTable,text} from "drizzle-orm/sqlite-core";

export const accountActivity=sqliteTable("account_activity",{
  subject:text("subject").primaryKey(),
  lastSeen:integer("last_seen").notNull(),
  returnedFromIdle:integer("returned_from_idle").notNull().default(0),
  minute:integer("minute").notNull().default(0),
  calls:integer("calls").notNull().default(0),
  elevatedSince:integer("elevated_since").notNull().default(0),
  extremeSince:integer("extreme_since").notNull().default(0),
  burstAt:integer("burst_at").notNull().default(0),
  prolongedAt:integer("prolonged_at").notNull().default(0),
});
