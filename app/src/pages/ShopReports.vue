<script setup>
import { computed, ref } from 'vue';
import { onIonViewWillEnter } from '@ionic/vue';
import Page from '../views/Page.vue';
import { api, safe, peso, fmt } from '../api';

const earnings = ref(null), generated = ref(false);
const localDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const today = new Date();
const from = ref(localDate(new Date(today.getFullYear(), today.getMonth(), 1)));
const to = ref(localDate(today));
const rows = computed(() => {
  if (!earnings.value || !from.value || !to.value) return [];
  const start = new Date(`${from.value}T00:00:00`).getTime() / 1000;
  const end = new Date(`${to.value}T23:59:59.999`).getTime() / 1000;
  return earnings.value.payments.filter((payment) => payment.status === 'paid'
    && payment.created_at >= start && payment.created_at <= end);
});
const totals = computed(() => rows.value.reduce((sum, payment) => ({
  gross: sum.gross + payment.amount - payment.platform_fee,
  commission: sum.commission + payment.commission,
  net: sum.net + payment.amount - payment.platform_fee - payment.commission,
}), { gross: 0, commission: 0, net: 0 }));
onIonViewWillEnter(async () => {
  await safe(async () => { earnings.value = await api('/earnings'); });
});
const generate = () => safe(async () => {
  if (!from.value || !to.value || from.value > to.value) throw new Error('Choose a valid date range.');
  earnings.value = await api('/earnings');
  generated.value = true;
});
const csvCell = (value) => {
  let text = String(value ?? '');
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};
function downloadCsv() {
  const header = ['Booking', 'Device', 'Date', 'Gross', 'Commission', 'Net earnings', 'Payout status'];
  const data = rows.value.map((payment) => [
    payment.booking_id, payment.device, fmt(payment.created_at),
    (payment.amount - payment.platform_fee).toFixed(2), payment.commission.toFixed(2),
    (payment.amount - payment.platform_fee - payment.commission).toFixed(2), payment.payout_status,
  ]);
  const csv = [header, ...data].map((row) => row.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `fixify-earnings-${from.value}-to-${to.value}.csv`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
</script>

<template>
  <Page title="Shop reports">
    <div class="card">
      <p class="muted">Generate a report of completed booking earnings for a date range.</p>
      <div class="row">
        <div class="field"><label for="report-from">From</label><input id="report-from" v-model="from" type="date" /></div>
        <div class="field"><label for="report-to">To</label><input id="report-to" v-model="to" type="date" /></div>
        <ion-button @click="generate">Generate report</ion-button>
        <ion-button v-if="generated" fill="outline" @click="downloadCsv">Download CSV</ion-button>
      </div>
    </div>
    <template v-if="generated">
      <div class="grid" style="margin-top:14px">
        <div class="card"><div class="muted">Booking volume</div><div class="stat">{{ peso(totals.gross) }}</div></div>
        <div class="card"><div class="muted">Commission</div><div class="stat">{{ peso(totals.commission) }}</div></div>
        <div class="card"><div class="muted">Net earnings</div><div class="stat">{{ peso(totals.net) }}</div></div>
      </div>
      <div class="card scroll-x" style="margin-top:14px">
        <strong>Completed bookings</strong>
        <p v-if="!rows.length" class="muted">No completed bookings in this date range.</p>
        <table v-else class="t">
          <tr><th>Booking</th><th>Device</th><th>Date</th><th>Gross</th><th>Commission</th><th>Net earnings</th><th>Payout</th></tr>
          <tr v-for="payment in rows" :key="payment.id">
            <td>#{{ payment.booking_id }}</td><td>{{ payment.device }}</td><td>{{ fmt(payment.created_at) }}</td>
            <td>{{ peso(payment.amount - payment.platform_fee) }}</td><td>{{ peso(payment.commission) }}</td>
            <td>{{ peso(payment.amount - payment.platform_fee - payment.commission) }}</td><td>{{ payment.payout_status }}</td>
          </tr>
        </table>
      </div>
    </template>
  </Page>
</template>
