import { formatDistanceToNow, parseISO } from 'date-fns';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  History,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useAdminAuditLogs,
  useReliabilitySummary,
  useStripeWebhookEvents,
  type AdminAuditLog,
  type StripeWebhookEvent,
} from '@/hooks/useReliabilityMonitoring';

function relativeTime(value: string | null) {
  if (!value) return 'No events yet';
  return `${formatDistanceToNow(parseISO(value), { addSuffix: true })}`;
}

function statusClass(status: string) {
  switch (status) {
    case 'processed':
      return 'border-success/40 bg-success/10 text-success';
    case 'failed':
      return 'border-destructive/40 bg-destructive/10 text-destructive';
    case 'ignored':
      return 'border-muted bg-muted text-muted-foreground';
    default:
      return 'border-warning/40 bg-warning/10 text-warning';
  }
}

function shortStripeId(value: string | null) {
  if (!value) return 'none';
  return value.length > 18 ? `${value.slice(0, 10)}...${value.slice(-4)}` : value;
}

function WebhookEventRow({ event }: { event: StripeWebhookEvent }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border/50 bg-background/45 p-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium">{event.event_type}</p>
          <Badge variant="outline" className={statusClass(event.status)}>
            {event.status}
          </Badge>
          {event.retry_count > 0 && (
            <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning">
              <RefreshCw className="mr-1 h-3 w-3" />
              retried {event.retry_count}
            </Badge>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {shortStripeId(event.stripe_event_id)} · PI {shortStripeId(event.payment_intent_id)}
        </p>
        {event.error_message && (
          <p className="mt-2 line-clamp-2 text-xs text-destructive">{event.error_message}</p>
        )}
      </div>
      <p className="shrink-0 text-xs text-muted-foreground">{relativeTime(event.last_received_at)}</p>
    </div>
  );
}

function AuditLogRow({ log }: { log: AdminAuditLog }) {
  return (
    <div className="rounded-xl border border-border/50 bg-background/45 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="capitalize">
              {log.action.replace(/_/g, ' ')}
            </Badge>
            <p className="truncate text-sm font-medium">{log.summary}</p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {log.entity_type}
            {log.changed_fields.length > 0 ? ` · ${log.changed_fields.join(', ')}` : ''}
          </p>
        </div>
        <p className="shrink-0 text-xs text-muted-foreground">{relativeTime(log.created_at)}</p>
      </div>
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((item) => (
        <Skeleton key={item} className="h-16 rounded-xl" />
      ))}
    </div>
  );
}

export function AdminReliabilityPanel() {
  const { data: events = [], isLoading: eventsLoading } = useStripeWebhookEvents();
  const { data: auditLogs = [], isLoading: auditLoading } = useAdminAuditLogs();
  const summary = useReliabilitySummary(events);

  return (
    <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
      <Card className="overflow-hidden border-border/70">
        <CardHeader className="border-b border-border/60 bg-muted/20">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg font-serif">
                <Activity className="h-5 w-5 text-primary" />
                Stripe Webhook Health
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Shows last received, failures, and retries from the live webhook endpoint.
              </p>
            </div>
            <Badge
              variant="outline"
              className={summary.healthy ? 'border-success/40 bg-success/10 text-success' : 'border-destructive/40 bg-destructive/10 text-destructive'}
            >
              {summary.healthy ? 'Healthy' : 'Needs review'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border/50 bg-background/50 p-3">
              <Clock className="mb-2 h-4 w-4 text-muted-foreground" />
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Last received</p>
              <p className="mt-1 text-sm font-semibold">{relativeTime(summary.lastReceived)}</p>
            </div>
            <div className="rounded-xl border border-border/50 bg-background/50 p-3">
              <AlertTriangle className="mb-2 h-4 w-4 text-muted-foreground" />
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Failed 24h</p>
              <p className="mt-1 text-sm font-semibold">{summary.failedCount}</p>
            </div>
            <div className="rounded-xl border border-border/50 bg-background/50 p-3">
              <RefreshCw className="mb-2 h-4 w-4 text-muted-foreground" />
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Retried 24h</p>
              <p className="mt-1 text-sm font-semibold">{summary.retriedCount}</p>
            </div>
          </div>

          {summary.lastFailure && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              Last failure: {summary.lastFailure.event_type} · {summary.lastFailure.error_message || 'No error message recorded'}
            </div>
          )}

          {eventsLoading ? (
            <LoadingRows />
          ) : events.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-success" />
              No webhook deliveries recorded yet.
            </div>
          ) : (
            <div className="space-y-2">
              {events.slice(0, 5).map((event) => (
                <WebhookEventRow key={event.id} event={event} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-border/70">
        <CardHeader className="border-b border-border/60 bg-muted/20">
          <CardTitle className="flex items-center gap-2 text-lg font-serif">
            <History className="h-5 w-5 text-primary" />
            Admin Audit Trail
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Tenant balances, payment status changes, and manual reconciliation are logged here.
          </p>
        </CardHeader>
        <CardContent className="p-4">
          {auditLoading ? (
            <LoadingRows />
          ) : auditLogs.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              <ShieldCheck className="mx-auto mb-2 h-6 w-6 text-success" />
              No audit records yet.
            </div>
          ) : (
            <div className="space-y-2">
              {auditLogs.slice(0, 7).map((log) => (
                <AuditLogRow key={log.id} log={log} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
