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
import Test from './Test';


function Home() {
  return (
      <div className="main"  >
          <br></br>
          <h1>AnnaRakshak</h1>
          <p>A simply transparent and reliable inventory management system</p>
          <Link to="/login">
            <button className='normalbtn' >Login</button>
          </Link>
          <Link to="/status">
            <button className='normalbtn' >Check Status</button>
          </Link>

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


          <Route path="*" element = {<NotFound></NotFound>} ></Route>

          <Route path="/test" element = {<Test></Test>} ></Route>
        </Routes>

  </BrowserRouter>

  );
}

export default App;
