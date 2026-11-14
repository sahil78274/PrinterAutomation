import { useState } from 'react';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import { useToast } from '../../context/ToastContext.jsx';

export default function AdminPlatformSettings() {
  const toast = useToast();
  const [settings, setSettings] = useState({
    platformName: 'SmartPrint',
    platformFeeBps: '600',
    maxUploadMb: '25',
    documentRetentionHours: '24',
    autoCancelMinutes: '20',
    defaultRateBw: '200',
    defaultRateColor: '500',
    maintenanceMode: false,
  });

  const handleChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    toast.success('Platform settings saved');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform settings"
        description="Global configuration for the SmartPrint platform."
        action={<Button size="sm" onClick={handleSave}>Save changes</Button>}
      />

      <Card>
        <h3 className="mb-4 text-[14px] font-semibold text-ink-900">General</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Platform name"
            value={settings.platformName}
            onChange={(e) => handleChange('platformName', e.target.value)}
          />
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-ink-700">Maintenance mode</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={settings.maintenanceMode}
                onClick={() => handleChange('maintenanceMode', !settings.maintenanceMode)}
                className={`relative h-5 w-9 rounded-full transition-colors ${settings.maintenanceMode ? 'bg-brand-500' : 'bg-ink-200'}`}
              >
                <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${settings.maintenanceMode ? 'translate-x-4' : ''}`} />
              </button>
              <span className="text-[12px] text-ink-600">
                {settings.maintenanceMode ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="mb-4 text-[14px] font-semibold text-ink-900">Financial</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Platform fee (basis points)"
            value={settings.platformFeeBps}
            onChange={(e) => handleChange('platformFeeBps', e.target.value)}
            hint="600 = 6% platform fee"
          />
          <Input
            label="Default B&W rate (paise/page)"
            value={settings.defaultRateBw}
            onChange={(e) => handleChange('defaultRateBw', e.target.value)}
            hint="200 = ₹2.00 per page"
          />
          <Input
            label="Default color rate (paise/page)"
            value={settings.defaultRateColor}
            onChange={(e) => handleChange('defaultRateColor', e.target.value)}
            hint="500 = ₹5.00 per page"
          />
        </div>
      </Card>

      <Card>
        <h3 className="mb-4 text-[14px] font-semibold text-ink-900">Operations</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Max upload size (MB)"
            value={settings.maxUploadMb}
            onChange={(e) => handleChange('maxUploadMb', e.target.value)}
          />
          <Input
            label="Document retention (hours)"
            value={settings.documentRetentionHours}
            onChange={(e) => handleChange('documentRetentionHours', e.target.value)}
            hint="Documents are deleted after this period"
          />
          <Input
            label="Auto-cancel unpaid orders (minutes)"
            value={settings.autoCancelMinutes}
            onChange={(e) => handleChange('autoCancelMinutes', e.target.value)}
          />
        </div>
      </Card>
    </div>
  );
}
