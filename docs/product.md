# Product

## One line

A player books and pays for a padel court in about 60 seconds, with no account and no WhatsApp chat. The desk and the owner run the venue from one dashboard.

## Problem

- A player messages the desk, waits for a reply, then gets a list of open times as text.
- They send a transfer screenshot and wait again for a confirmation.
- Unpaid holds block prime evening slots.
- Rain on the outdoor court means a round of calls.
- The desk chases balances by hand.

## Who it is for

| Person | Wants | Where they work in the app |
|---|---|---|
| Player (guest, no account) | See what is free, lock it, pay, get a ticket | Landing, Book, Ticket, Find my booking, Reschedule, Check-in |
| Front desk (Dewi) | Who plays tonight, who still owes, what needs a hand | Desk: Today, Bookings, Payments, Courts, Waitlist |
| Owner (Hendra) | Revenue, court use, prices, staff | Owner: This week, Prices and staff |

## Goals

- A guest completes a booking in under 60 seconds.
- Unpaid holds release themselves after 15 minutes, with no staff action.
- The desk sees every balance due before play on one screen.
- The owner can say how many bookings this week needed no chat.

## Key flows

1. **Book.** Pick day, length and start time. Pick a court. Hold it. Add name, WhatsApp and add-ons. Pay a deposit or in full. Land on the ticket.
2. **Hold runs out.** The slot frees, the player lands on a page with the nearest open times, and the next player on the waitlist gets an offer.
3. **Waitlist.** Tap a taken slot, join the list. When the slot frees, the first player gets a 15 minute offer. If they pass or the time runs out, the offer moves on.
4. **Pay the balance.** From the ticket, any time before the due time.
5. **Reschedule.** Free up to 12 hours before play. What was paid carries over.
6. **Check-in.** At the venue, scan the ticket QR or type the code plus the last four digits of the WhatsApp number.
7. **Rain mode.** The desk turns it on for the outdoor court. Affected players get a free move to a covered court or a new time.
8. **Desk day.** Today view, mark balances paid, resolve odd payments, block a court, run the waitlist.
9. **Owner week.** KPIs, court use, busiest hours, system log. Change prices and rules.

## Booking rules

| Rule | Default |
|---|---|
| Court 1 and 2, indoor | Rp 350.000 off-peak, Rp 550.000 peak, per hour |
| Court 3, panoramic outdoor | Rp 400.000 off-peak, Rp 600.000 peak, per hour |
| Peak | Weekdays 17.00 to 23.00, weekends all day |
| Opening hours | 06.00 to 23.00 |
| Hold | 15 minutes |
| Deposit | 50% |
| Balance due | 2 hours before play |
| Free reschedule | Up to 12 hours before play |
| Waitlist offer | 15 minutes, then the next player |

The owner can change every rule. They live in the `venue_settings` and `price_rules` tables.

## Formats and copy

- Currency `Rp 550.000`. Times `20.00`, 24 hour clock. Ranges "20.00 to 21.30". Dates `Sat 3 Oct`.
- All times are shown in Asia/Jakarta.
- UI copy in English, short, from the player's point of view. No em dashes.

## Out of scope for v1

- Sending real WhatsApp messages (they are queued in `notifications`).
- A real payment provider (Midtrans or Xendit). The sandbox stands in.
- Split payment between players.
