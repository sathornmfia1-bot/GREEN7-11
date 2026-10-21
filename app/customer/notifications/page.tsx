'use client';

import { NotificationList } from '../../_components/notification-list';

export default function CustomerNotificationsPage() {
  return <NotificationList role="customer" jobsHref="/customer/bookings" />;
}
