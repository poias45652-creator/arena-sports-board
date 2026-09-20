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
export const arenaSessions=sqliteTable('arena_sessions',{
 tokenHash:text('token_hash').primaryKey(),memberId:text('member_id').notNull().references(()=>tzBindings.memberId,{onDelete:'cascade'}),expiresAt:integer('expires_at').notNull()
},t=>[index('arena_sessions_member').on(t.memberId),index('arena_sessions_expiry').on(t.expiresAt)]);
export const accountAccess=sqliteTable('account_access',{
 memberId:text('member_id').primaryKey(),enabled:integer('enabled').notNull().default(1),expiresAt:integer('expires_at'),updatedAt:integer('updated_at').notNull(),
});

export const turnstileSettings=sqliteTable('turnstile_settings',{id:text('id').primaryKey(),encryptedSecret:text('encrypted_secret').notNull(),enabled:integer('enabled').notNull().default(0),updatedAt:integer('updated_at').notNull()});

export const baseballCurrent=sqliteTable('baseball_current',{
 key:text('key').primaryKey(),league:text('league').notNull(),date:text('date').notNull(),
 fetchedAt:text('fetched_at').notNull(),status:text('status').notNull(),payload:text('payload').notNull()
},t=>[index('baseball_current_league_date').on(t.league,t.date)]);
export const baseballPregame=sqliteTable('baseball_pregame',{
 key:text('key').primaryKey(),league:text('league').notNull(),date:text('date').notNull(),observedAt:text('observed_at').notNull(),payload:text('payload').notNull()
},t=>[index('baseball_pregame_league_date').on(t.league,t.date)]);

export const baseballLogSnapshots=sqliteTable('baseball_log_snapshots',{
 key:text('key').primaryKey(),league:text('league').notNull(),season:integer('season').notNull(),observedAt:text('observed_at').notNull(),payload:text('payload').notNull()
});

export const internationalForecasts=sqliteTable('international_forecasts',{
 id:text('id').primaryKey(),league:text('league').notNull(),fixtureKey:text('fixture_key').notNull(),
 date:text('date').notNull(),startTime:text('start_time').notNull(),capturedAt:text('captured_at').notNull(),
 version:text('version').notNull(),payload:text('payload').notNull()
},t=>[index('international_forecast_fixture_version').on(t.fixtureKey,t.version,t.capturedAt),index('international_forecast_start').on(t.startTime)]);

export const baseballResearch=sqliteTable('baseball_research',{
 key:text('key').primaryKey(),league:text('league').notNull(),section:text('section').notNull(),
 entity:text('entity').notNull(),observedAt:text('observed_at').notNull(),sourceAsOf:text('source_as_of'),
 sourceUrl:text('source_url').notNull(),contentHash:text('content_hash').notNull(),
 payload:text('payload').notNull(),importedAt:text('imported_at').notNull(),batchId:text('batch_id').notNull()
},t=>[index('baseball_research_section_league').on(t.section,t.league)]);
