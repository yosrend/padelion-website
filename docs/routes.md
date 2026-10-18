# Routes

File-based routes in `src/routes`. `_staff` is a pathless layout that requires a signed-in staff member.

## Player (public, no account)

| Route | Page | What happens |
|---|---|---|
| `/` | Home | Video hero with the next open court, four step walkthrough, 3D court that builds piece by piece, prices, rackets, club, visit info, FAQ |
| `/book` | Book | Pick day, length and start time, live availability for three courts, waitlist on taken slots, hold, guest details, add-ons, payment |
| `/booking/$code` | Ticket | Court, time, paid and balance, check-in QR, pay balance, add to calendar, share, reschedule |
| `/hold-expired/$code` | Hold ran out | Nearest open times for the same day |
| `/offer/$id` | Waitlist offer | Take or pass a freed slot within the offer time |
| `/reschedule/$code` | Move your game | Pick a new time or court, free within the window |
| `/find` | Find my booking | WhatsApp number plus a one-time code, coming up and played |
| `/checkin` | Check-in | Scan the ticket QR with the camera or type the code and last 4 WhatsApp digits. Resets for the next guest |
| `/demo` | Demo tour | Five steps through the player, desk and owner views |

## Staff (signed in)

| Route | Role | Page |
|---|---|---|
| `/staff/login` | Staff | Email and password sign-in. `?as=desk` or `?as=owner` fills the demo account |
| `/desk` | Front desk, owner | Today: KPIs, court timeline, needs you before play, rain mode, live updates |
| `/desk/bookings` | Front desk, owner | Search, filters, detail panel, move and cancel |
| `/desk/payments` | Front desk, owner | Payments to check: overpaid, no code, late |
| `/desk/courts` | Front desk, owner | Court blocks and closures |
| `/desk/waitlist` | Front desk, owner | Waitlist per slot, offer now, remove |
| `/owner` | Owner | This week: revenue, court use by day and hour, KPIs, system log |
| `/owner/settings` | Owner | Prices, booking rules, add-ons, staff |

The staff area uses its own theme: white and lime, black text, a top bar and content up to 1280 px wide.
