import { ExternalLink } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { getGoogleCalendarEmbedUrl, getGoogleCalendarWebAppUrl } from '../lib/calendarUrls';

type GoogleCalendarEmbedProps = {
  /** Card heading */
  title?: string;
  /** Subtitle under the title (omit for default copy) */
  description?: string;
  /** iframe height in px */
  height?: number;
};

/**
 * Embeds the Margav booking Google Calendar (read-only iframe from Calendar → Integrate calendar).
 * Google does not provide the full “click to create event” UI inside the embed; use **Open in Google Calendar**
 * for the normal web app, or create events from the CRM (Calendar API sync).
 */
export function GoogleCalendarEmbed({
  title = 'Appointment calendar',
  description,
  height = 600,
}: GoogleCalendarEmbedProps) {
  const embedUrl = getGoogleCalendarEmbedUrl();
  const webAppUrl = getGoogleCalendarWebAppUrl();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
        <CardDescription className="text-foreground/90 pt-2 space-y-3">
          <p>
            The embedded view is for reference only — Google opens the full calendar in a new tab when you try to
            add or edit events there. To create events like in Google Calendar, use the button below (you must be
            signed into Google with access to this calendar).
          </p>
          <Button variant="default" size="sm" asChild>
            <a href={webAppUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in Google Calendar
            </a>
          </Button>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border overflow-hidden bg-white" style={{ minHeight: height }}>
          <iframe
            src={embedUrl}
            style={{ border: 0, width: '100%', height }}
            title="Google Calendar — booking"
            loading="lazy"
          />
        </div>
      </CardContent>
    </Card>
  );
}
