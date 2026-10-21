import react from 'react';
import Nav from './navbar';
import Footer from './footer';

function NotFound() {
  return (
    <div>
      <Nav></Nav>
      <br></br>
      <h1>404 <br></br>Page Not Found...</h1>
      <Footer></Footer>
    </div>
  );
}

export default NotFound;