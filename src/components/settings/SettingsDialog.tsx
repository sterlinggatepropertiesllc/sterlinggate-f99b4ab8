import { Settings, Bell, Webhook, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNotificationSettings } from '@/hooks/useNotificationSettings';
import { DiscordSettings } from './DiscordSettings';
import { FeesSettings } from './FeesSettings';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export function SettingsDialog() {
  const { settings, loading, saving, updateSettings, testDiscordWebhook, testNotificationType } = useNotificationSettings();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'h-10 w-10 rounded-lg transition-all duration-200',
            'hover:bg-primary/10 hover:text-primary'
          )}
        >
          <Settings className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Settings</DialogTitle>
          <DialogDescription>
            Manage your notification preferences and integrations
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
          </div>
        ) : settings ? (
          <Tabs defaultValue="fees" className="mt-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="fees" className="gap-2">
                <DollarSign className="h-4 w-4" />
                Fees
              </TabsTrigger>
              <TabsTrigger value="discord" className="gap-2">
                <Webhook className="h-4 w-4" />
                Discord
              </TabsTrigger>
              <TabsTrigger value="notifications" className="gap-2">
                <Bell className="h-4 w-4" />
                In-App
              </TabsTrigger>
            </TabsList>

            <TabsContent value="fees" className="mt-4 max-h-[55vh] overflow-y-auto pr-1">
              <FeesSettings />
            </TabsContent>

            <TabsContent value="discord" className="mt-4 max-h-[55vh] overflow-y-auto pr-1">
              <DiscordSettings
                settings={settings}
                saving={saving}
                onUpdate={updateSettings}
                onTestWebhook={testDiscordWebhook}
                onTestType={testNotificationType}
              />
            </TabsContent>

            <TabsContent value="notifications" className="mt-4">
              <div className="text-center py-8 text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto mb-3 opacity-50" />
                <p className="text-sm">In-app notification settings coming soon</p>
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>Failed to load settings</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
