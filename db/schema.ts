import {sqliteTable,text,integer,index} from 'drizzle-orm/sqlite-core';
export const analysisSnapshots=sqliteTable('analysis_snapshots',{
 id:text('id').primaryKey(),gameId:integer('game_id').notNull(),startTime:text('start_time').notNull(),capturedAt:text('captured_at').notNull(),version:text('version').notNull(),payload:text('payload').notNull()
},t=>[index('analysis_game_captured').on(t.gameId,t.capturedAt),index('analysis_start').on(t.startTime)]);
export const analysisResults=sqliteTable('analysis_results',{
 gameId:integer('game_id').primaryKey(),scheduledStart:text('scheduled_start'),away:integer('away').notNull(),home:integer('home').notNull(),fetchedAt:text('fetched_at').notNull()
});
export const tzBindings=sqliteTable('tz_bindings',{
 memberId:text('member_id').primaryKey(),sourceUserId:text('source_user_id').notNull(),username:text('username').notNull(),deviceId:text('device_id').notNull(),encryptedToken:text('encrypted_token').notNull(),expiresAt:integer('expires_at').notNull(),verifiedAt:integer('verified_at').notNull(),gameUrl:text('game_url')
});
export const tzBindingAttempts=sqliteTable('tz_binding_attempts',{
 memberId:text('member_id').primaryKey(),allowedAt:integer('allowed_at').notNull(),operationId:text('operation_id').notNull()
});
export const hrConnections=sqliteTable('hr_connections',{
 memberId:text('member_id').primaryKey().references(()=>tzBindings.memberId,{onDelete:'cascade'}),
 bindingVersion:integer('binding_version').notNull(),encryptedSession:text('encrypted_session'),
 snapshot:text('snapshot'),fetchedAt:integer('fetched_at'),lastError:text('last_error'),errorCode:text('error_code'),
 busyUntil:integer('busy_until').notNull().default(0),operationId:text('operation_id').notNull()
});
