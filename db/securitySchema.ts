import {index,integer,sqliteTable,text} from "drizzle-orm/sqlite-core";

export const requestWindows=sqliteTable("request_windows",{
  actor:text("actor").primaryKey(),
  window:integer("window").notNull(),
  calls:integer("calls").notNull(),
},table=>[index("request_window_expiry").on(table.window)]);

export const providerCalls=sqliteTable("provider_calls",{
  id:text("id").primaryKey(),
  provider:text("provider").notNull(),
  day:text("day").notNull(),
  actor:text("actor").notNull(),
  lookup:text("lookup").notNull(),
  created:integer("created").notNull(),
  result:text("result"),
},table=>[index("provider_daily_total").on(table.provider,table.day,table.actor),index("provider_cached_result").on(table.provider,table.lookup,table.created)]);
