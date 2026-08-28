import { Link } from 'react-router-dom';

import MessageScreen from '../components/MessageScreen';

/** Anything that matches no route. Without it the page renders empty. */
export default function NotFoundPage() {
  return (
    <MessageScreen
      title="Page not found"
      body="That address does not match anything in Skymate. It may have moved, or the link may be wrong."
      action={
        <Link className="message__button" to="/">
          Go to flights
        </Link>
      }
    />
  );
}
