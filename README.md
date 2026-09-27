# Skymate

A departure and arrival board for any airport, drawn on a time axis rather than
as a list, with a travel assistant alongside it.

Pick an airport, a day and a window of up to twelve hours, and Skymate lays that
window out as a board you drag through: each flight is a card at the minute it
is scheduled, lanes deep enough that nothing overlaps, a line marking the
present moment. Opening a card slides in what the board knows about that flight,
and one button asks the one thing it cannot know, which is whether it landed.

Skymate is not a fare search. It has no prices, no booking and no round trips.
It answers when a flight leaves, whether it is late and which gate it goes from,
not what it costs.

## What it does

- **A board, not a table.** Flights sit on a time axis at their scheduled
  minute. Drag it, scroll it, use the arrow keys, or pull the scrubber along the
  bottom.
- **One country at a time.** Twelve hours out of a large airport is several
  hundred flights, which is more than any board can hold apart. The picker shows
  one country's flights at a time and opens on whichever has the most.
- **Narrow to a destination.** Chips count the airports the window reaches and
  filter the board down to one of them.
- **What the board knows about a flight.** Scheduled and revised times, status,
  terminal, gate, check in desk and aircraft, with anything unpublished saying
  so rather than being guessed at.
- **Whether it landed.** A departures board is written from the departure
  airport's point of view and stops at "Departed". One button asks about that
  one flight and brings back where and when it arrived, then marks the card.
- **An assistant that knows where you are.** The drawer carries the airport the
  board is showing, so "how early should I get here" has an answer. A flight can
  be handed to it with its details already written into the question.
- **A list on a narrow screen.** Below 760px the axis becomes a vertical list of
  the same cards, because a board is a surface you move around in and a phone
  has no room to move.

## Built with

React 19 and TypeScript on Vite, an Express API, GSAP and Framer Motion for the
movement, and Phosphor for the icons. Flight schedules and status come from
AeroDataBox. The assistant runs on Claude, with a Groq model behind it.

## Hosting

A hosted version is on the way. There is nothing to set up in the meantime: the
link will go here once it is live.
