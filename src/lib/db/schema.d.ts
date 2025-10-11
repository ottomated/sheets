import type { ColumnType } from "kysely";
export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export type Session = {
    id: string;
    expires_at: number;
    user_id: string;
};
export type SharedLink = {
    id: string;
    sheet_id: string;
    /**
     * @kyselyType('read' | 'write')
     */
    access_type: 'read' | 'write';
    created_at: string;
    expires_at: string | null;
};
export type Sheet = {
    id: string;
    name: string;
    created_at: string;
    opened_at: string | null;
    updated_at: string;
    deleted_at: string | null;
    data: string;
};
export type User = {
    id: string;
    username: string;
    password: string;
    created_at: string;
};
export type DB = {
    Session: Session;
    SharedLink: SharedLink;
    Sheet: Sheet;
    User: User;
};
