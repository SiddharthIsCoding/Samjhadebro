import './App.css';
import Normalbutton from "./Normalbtn";
import Nav from './navbar';
import Footer from "./footer";
import {BrowserRouter, Routes, Route , Link } from "react-router-dom";
import LoginPage from './login';
import Signup from './signup';
import NotFound from './404';
import {useEffect , useState} from "react";
import {getAuth, onAuthStateChanged} from "firebase/auth";
import Dashboard from './Dashboard';


function Home() {
  return (
    <div>
      <Nav></Nav>

      <h1>Welcome to <br></br> <span>" SamjhadeBro "</span> </h1>

      <Link to="/login" ><Normalbutton link="/login" txt="Login"></Normalbutton></Link>
      <Link to="/signup" ><Normalbutton link="/signup" txt="Signup"></Normalbutton></Link>

      <Footer></Footer>
    </div>
  )
}



function App() {

  const [user, setUser] = useState(null);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
      } else {
        setUser(null);
      }
    });

    return () => unsubscribe();
  }, []);



  return (
    <BrowserRouter>
     
        <Routes>
          <Route path="/" element={user?(<Dashboard></Dashboard>):(<Home></Home>)} ></Route>

          <Route path="/login" element={<LoginPage></LoginPage>} ></Route>

          <Route path="/signup" element={<Signup></Signup>} ></Route>

          <Route path="*" element = {<NotFound></NotFound>} ></Route>
        </Routes>

  </BrowserRouter>

  );
}

export default App;
