import { useEffect, useState } from 'react';
import { Building2, Clock, Landmark, Save, Store, Wallet } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Card, { CardHeader } from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Input, { Switch, Textarea } from '../../components/ui/Input.jsx';
import Badge from '../../components/ui/Badge.jsx';
import { MockBadge, MockNotice } from '../../components/ui/MockNotice.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { getShop, updateShop, updateShopSettings } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { formatDate } from '../../lib/utils.js';

export default function ShopSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const shopQuery = useAsync(() => getShop(user?.shopId), [user?.shopId]);

  const [profile, setProfile] = useState(null);
  const [settings, setSettings] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (shopQuery.data) {
      setProfile({
        name: shopQuery.data.name,
        ownerName: shopQuery.data.ownerName,
        email: shopQuery.data.email,
        phone: shopQuery.data.phone,
        address: shopQuery.data.address,
        city: shopQuery.data.city,
        state: shopQuery.data.state,
        pincode: shopQuery.data.pincode,
        gstin: shopQuery.data.gstin,
        openHours: shopQuery.data.openHours,
      });
      setSettings(shopQuery.data.settings);
    }
  }, [shopQuery.data]);

  if (shopQuery.loading || !profile || !settings) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-72 w-full rounded-xl" />
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
    );
  }

  const shop = shopQuery.data;
  const update = (key) => (event) => setProfile((prev) => ({ ...prev, [key]: event.target.value }));

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      await updateShop(shop.id, profile);
      toast({ type: 'success', title: 'Shop profile saved' });
      shopQuery.refetch();
    } catch (error) {
      toast({ type: 'error', title: 'Could not save', description: error.message });
    } finally {
      setSavingProfile(false);
    }
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      await updateShopSettings(shop.id, settings);
      toast({ type: 'success', title: 'Operating preferences saved' });
      shopQuery.refetch();
    } catch (error) {
      toast({ type: 'error', title: 'Could not save', description: error.message });
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Shop profile"
        eyebrow="Settings"
        description={
          <span className="flex flex-wrap items-center gap-2">
            Business details, operating preferences and payout configuration. <MockBadge />
          </span>
        }
        actions={
          <Button size="md" icon={Save} onClick={saveProfile} loading={savingProfile}>
            Save profile
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Business details"
              description="Shown to customers on the QR portal"
              icon={Store}
              action={
                <Badge tone={shop.planStatus === 'active' ? 'success' : 'warning'} size="sm" dot>
                  {shop.planStatus}
                </Badge>
              }
            />
            <div className="grid gap-4 border-t border-line p-5 sm:grid-cols-2">
              <Input label="Shop name" value={profile.name} onChange={update('name')} />
              <Input label="Owner name" value={profile.ownerName} onChange={update('ownerName')} />
              <Input label="Email" type="email" value={profile.email} onChange={update('email')} />
              <Input label="Phone" value={profile.phone} onChange={update('phone')} />
              <Input
                label="GSTIN"
                value={profile.gstin}
                onChange={update('gstin')}
                className="sm:col-span-2"
                hint="Used on platform invoices"
              />
              <Textarea
                label="Address"
                value={profile.address}
                onChange={update('address')}
                rows={2}
                className="sm:col-span-2"
              />
              <Input label="City" value={profile.city} onChange={update('city')} />
              <Input label="State" value={profile.state} onChange={update('state')} />
              <Input label="Pincode" value={profile.pincode} onChange={update('pincode')} />
              <Input
                label="Open hours"
                value={profile.openHours}
                onChange={update('openHours')}
                icon={Clock}
              />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Operating preferences"
              description="Control how the customer portal behaves for your shop"
              icon={Clock}
              action={
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={saveSettings}
                  loading={savingSettings}
                >
                  Save
                </Button>
              }
            />
            <div className="divide-y divide-line border-t border-line px-5">
              <Switch
                label="Accept new orders"
                description="Turning this off hides the upload option on every machine in this shop."
                checked={settings.acceptOrders}
                onChange={(value) => setSettings((prev) => ({ ...prev, acceptOrders: value }))}
              />
              <Switch
                label="Require payment before printing"
                description="Recommended. Jobs are only released to the print agent once payment is verified."
                checked={settings.requirePaymentBeforePrint}
                onChange={(value) =>
                  setSettings((prev) => ({ ...prev, requirePaymentBeforePrint: value }))
                }
              />
              <Switch
                label="Notify customers on completion"
                description="Send an in-browser status update when the job finishes printing."
                checked={settings.notifyOnJobComplete}
                onChange={(value) =>
                  setSettings((prev) => ({ ...prev, notifyOnJobComplete: value }))
                }
              />
              <div className="grid gap-4 py-4 sm:grid-cols-2">
                <Input
                  label="Max upload size (MB)"
                  type="number"
                  min={1}
                  max={100}
                  value={settings.maxUploadMb}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, maxUploadMb: Number(e.target.value) }))
                  }
                />
                <Input
                  label="Auto-cancel unpaid orders (min)"
                  type="number"
                  min={5}
                  max={120}
                  value={settings.autoCancelMinutes}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, autoCancelMinutes: Number(e.target.value) }))
                  }
                />
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Account" icon={Building2} />
            <div className="space-y-2.5 px-5 pb-5 text-[12.5px]">
              <Row label="Shop ID" value={<span className="font-mono">{shop.id}</span>} />
              <Row label="Joined" value={formatDate(shop.joinedOn)} />
              <Row label="Rating" value={`${shop.rating} ★ (${shop.reviews} reviews)`} />
              <Row label="Plan" value={<span className="capitalize">{shop.planId}</span>} />
              <Row label="Renews" value={formatDate(shop.planRenewsOn)} />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Payout account"
              description="Where settlements are transferred"
              icon={Landmark}
            />
            <div className="space-y-3 px-5 pb-5">
              <div className="rounded-lg border border-line bg-surface-muted/50 p-3">
                <p className="text-[10.5px] uppercase tracking-[0.08em] text-ink-400">Method</p>
                <p className="mt-0.5 text-[13px] font-medium text-ink-900">{shop.payout.method}</p>
                <p className="mt-0.5 font-mono text-[11.5px] text-ink-500">{shop.payout.handle}</p>
                <p className="mt-1.5 inline-flex items-center gap-1 rounded bg-white px-1.5 py-0.5 text-[10.5px] text-ink-500 ring-1 ring-line">
                  <Wallet className="size-2.5" /> Settlement cycle {shop.payout.cycle}
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={() =>
                  toast({
                    type: 'info',
                    title: 'Payout changes need verification',
                    description:
                      'Bank account changes require re-verification and are disabled in preview.',
                  })
                }
              >
                Change payout account
              </Button>
            </div>
          </Card>

          <MockNotice tone="neutral" title="Profile changes are local">
            Updates are written to the in-memory demo store and reset on refresh. Production writes
            go through PATCH /api/shops/:id with server-side validation.
          </MockNotice>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-ink-500">{label}</span>
      <span className="min-w-0 truncate text-right font-medium text-ink-900">{value}</span>
    </div>
  );
}
