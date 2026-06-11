import "server-only";
import { createClient } from "@libsql/client/web";
import { drizzle } from "drizzle-orm/libsql";
import { serverEnv } from "../env";
import * as schema from "./platform-schema";

type PlatformDb = ReturnType<typeof drizzle<typeof schema>>;

// Lazily constructed on first use so importing a route at build time (when
// preview/CI envs may lack Turso credentials) never instantiates the client.
let _db: PlatformDb | null = null;
function getDb(): PlatformDb {
  if (!_db) {
    const client = createClient({
      url: serverEnv.platformDbUrl.replace(/^libsql:\/\//, "https://"),
      authToken: serverEnv.platformDbToken,
    });
    _db = drizzle(client, { schema });
  }
  return _db;
}

export const platformDb = new Proxy({} as PlatformDb, {
  get(_target, prop) {
    return Reflect.get(getDb(), prop, getDb());
  },
});
