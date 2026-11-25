import {integer,sqliteTable,text} from "drizzle-orm/sqlite-core";

export const musicProfiles=sqliteTable("music_profiles",{
  userId:text("user_id").primaryKey(),
  revision:integer("revision").notNull(),
  payload:text("payload").notNull(),
});
