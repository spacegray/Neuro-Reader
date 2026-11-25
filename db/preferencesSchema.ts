import {integer,sqliteTable,text} from "drizzle-orm/sqlite-core";
export const readerPreferences=sqliteTable("reader_preferences",{
  userId:text("user_id").primaryKey(),
  revision:integer("revision").notNull(),
  payload:text("payload").notNull(),
});
