# Round product backlog

North star: **close the friend-lunch loop** — invite → RSVP → settle → day-of kitchen view. Manual settle only (Round does not process payments). Prefer WhatsApp-native flows over email/push products.

## Active — Tier A (shipped)

Ordered as suggested build sequence.

### 1. Allergy digest → WhatsApp — done
### 2. Restaurant booking ping — done
### 3. Maps deep-link in invite — done
### 4. Change-of-plan share card — done
### 5. Walk-up RSVP QR — done
### 6. Guest “I sent it” attest — done

**Next build focus:** Tier B (parked below) after 2–3 real events.

---

## Parked — Tier B (mid-size)

Unpark after **2–3 real events** have used the current P0/P1 features (payment instructions, kitchen, share, RSVP close, nudges).

| Idea | Pitch | Effort |
|---|---|---|
| Shared table pots | Split wine/tip/corkage N-ways on PaymentBoard | M |
| Post-meal settle mode | Enter restaurant total; propose remaining IOUs vs prepaid marks | M |
| Duplicate RSVP merge | Detect same name/phone; merge or drop | M |
| Tentative / maybe RSVP | Soft yes without locking a dish until confirmed | M |
| Usual-crew seed | Pull names from a past gathering into a new event | M |
| Soft “aiming for ~N” | Expected headcount progress (“9 of ~12”), no waitlist | S–M |

**When unparking PaymentBoard depth:** pick **either** shared pots **or** post-meal settle first — not both at once.

---

## Parked — Tier C (stretch)

| Idea | Pitch | Effort |
|---|---|---|
| Receipt-photo → extras | OCR a bill photo to suggest `extraAmount` rows (reuse carte OCR) | L |
| Recurring Tuesday lunch | Lightweight cron/reminder for the same crew (WhatsApp deep links, not email) | L |

---

## Shipped (do not re-backlog)

- Payment instructions (IBAN / MB Way / Bizum / note / QR)
- WhatsApp / native invite share; share-step done
- Kitchen / dietary rollup
- Guest cancel RSVP
- Setup polish (title/notes edit, labels)
- RSVP deadline / close registration
- Unpaid nudge links
- Restaurant order sheet
- Calendar `.ics`
- Contact + email visibility on RSVP
- Skip menu step when no priced menu
- Google + organizer-code dual auth, claim, Your events
- Per-person PaymentBoard, printable report, guest→organizer inbox, OCR carte, admin archive

## Explicit non-goals (still parked)

- Real payment rails (Stripe / MB Way API as processor)
- Outbound email digests / push notification product
- Organizer reply-in-inbox as primary channel
- Capacity / waitlist
- Full multi-event templates
- Live PaymentBoard polling / WebSockets
- Apple Sign-In
- Native apps
