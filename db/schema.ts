import {sqliteTable,text,integer,index,uniqueIndex,primaryKey,foreignKey} from "drizzle-orm/sqlite-core";
const created=()=>integer("created_at",{mode:"timestamp_ms"}).notNull();
const updated=()=>integer("updated_at",{mode:"timestamp_ms"}).notNull();
// Better Auth owns Google identity, sessions and OAuth verification records.
export const user=sqliteTable("user",{
  id:text("id").primaryKey(),name:text("name").notNull(),email:text("email").notNull().unique(),
  emailVerified:integer("email_verified",{mode:"boolean"}).notNull().default(false),image:text("image"),createdAt:created(),updatedAt:updated(),
});
export const session=sqliteTable("session",{
  id:text("id").primaryKey(),userId:text("user_id").notNull().references(()=>user.id,{onDelete:"cascade"}),token:text("token").notNull().unique(),
  expiresAt:integer("expires_at",{mode:"timestamp_ms"}).notNull(),createdAt:created(),updatedAt:updated(),ipAddress:text("ip_address"),userAgent:text("user_agent"),
},t=>[index("session_user").on(t.userId)]);
export const account=sqliteTable("account",{
  id:text("id").primaryKey(),userId:text("user_id").notNull().references(()=>user.id,{onDelete:"cascade"}),accountId:text("account_id").notNull(),providerId:text("provider_id").notNull(),
  accessToken:text("access_token"),refreshToken:text("refresh_token"),idToken:text("id_token"),accessTokenExpiresAt:integer("access_token_expires_at",{mode:"timestamp_ms"}),refreshTokenExpiresAt:integer("refresh_token_expires_at",{mode:"timestamp_ms"}),scope:text("scope"),password:text("password"),createdAt:created(),updatedAt:updated(),
},t=>[index("account_user").on(t.userId),uniqueIndex("account_provider_identity").on(t.providerId,t.accountId)]);
export const verification=sqliteTable("verification",{id:text("id").primaryKey(),identifier:text("identifier").notNull(),value:text("value").notNull(),expiresAt:integer("expires_at",{mode:"timestamp_ms"}).notNull(),createdAt:created(),updatedAt:updated()},t=>[index("verification_identifier").on(t.identifier)]);
export const personalTrips=sqliteTable("personal_trips",{
  ownerId:text("owner_id").notNull().references(()=>user.id,{onDelete:"cascade"}),id:text("id").notNull(),snapshot:text("snapshot").notNull(),revision:integer("revision").notNull().default(1),mutationId:text("mutation_id").notNull(),createdAt:text("created_at").notNull(),updatedAt:text("updated_at").notNull(),
},t=>[primaryKey({columns:[t.ownerId,t.id]}),index("trips_owner_updated").on(t.ownerId,t.updatedAt)]);
export const itineraryStops=sqliteTable("itinerary_stops",{
  ownerId:text("owner_id").notNull(),tripId:text("trip_id").notNull(),activityId:text("activity_id").notNull(),dayIndex:integer("day_index").notNull(),stopIndex:integer("stop_index").notNull(),locationId:text("location_id"),name:text("name").notNull(),
},t=>[primaryKey({columns:[t.ownerId,t.tripId,t.activityId]}),foreignKey({columns:[t.ownerId,t.tripId],foreignColumns:[personalTrips.ownerId,personalTrips.id]}).onDelete("cascade"),index("itinerary_location").on(t.locationId)]);
export const bookmarks=sqliteTable("bookmarks",{
  ownerId:text("owner_id").notNull().references(()=>user.id,{onDelete:"cascade"}),placeId:text("place_id").notNull(),snapshot:text("snapshot").notNull(),createdAt:text("created_at").notNull(),
},t=>[primaryKey({columns:[t.ownerId,t.placeId]}),index("bookmarks_owner_created").on(t.ownerId,t.createdAt)]);
