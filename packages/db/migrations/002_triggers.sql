-- PlugQueue: LISTEN/NOTIFY triggers for reactive queue advancement

-- Notify when a stall status changes
create or replace function notify_stall_change()
returns trigger as $$
begin
  if (old.current_status is distinct from new.current_status) then
    perform pg_notify(
      'stall_changed',
      json_build_object(
        'station_id', new.station_id,
        'stall_label', new.label,
        'old_status', old.current_status,
        'new_status', new.current_status,
        'changed_at', now()
      )::text
    );
  end if;
  return new;
end;
$$ language plpgsql;

create trigger stalls_status_change
  after update on stalls
  for each row
  execute function notify_stall_change();

-- Notify when queue changes (for WebSocket broadcast)
create or replace function notify_queue_change()
returns trigger as $$
begin
  perform pg_notify(
    'queue_changed',
    json_build_object(
      'station_id', coalesce(new.station_id, old.station_id),
      'action', tg_op
    )::text
  );
  return coalesce(new, old);
end;
$$ language plpgsql;

create trigger queue_entries_change
  after insert or update or delete on queue_entries
  for each row
  execute function notify_queue_change();
