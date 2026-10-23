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
import {auth , db } from './firebase';
import {doc , getDoc} from 'firebase/firestore';
import Addstock from './Addstock';
import Dispatch from './dispatch';

function Home() {
  return (
      <div className="main"  >
        <Nav></Nav>
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

  const [role,setRole] = useState("");

  const [UserName,setUserName] = useState("");

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                setUserName(currentUser.displayName);

                try {
                    const userDocRef = doc(db, "users", currentUser.uid);
                    const docSnap = await getDoc(userDocRef);
                    
                    if (docSnap.exists()) {
                        setRole(docSnap.data().role);
                    }
                } catch (error) {
                    console.error("Error fetching user role:", error);
                }
            } else {
                setUserName("");
                setRole("");
                setUser(null);
            }
        });

        return () => unsubscribe();
    }, []);



  return (
    <BrowserRouter>
     
        <Routes>
          <Route path="/" element={user&& role && role.toLowerCase()=="admin"?(<Dashboard></Dashboard>):(<Home></Home>)} ></Route>

          <Route path="/login" element={<LoginPage></LoginPage>} ></Route>

          <Route path="/signup" element={<Signup></Signup>} ></Route>

          <Route path="/addstock" element={<Addstock></Addstock>} ></Route>

          <Route path="/dispatch" element={<Dispatch></Dispatch>} ></Route>




          <Route path="*" element = {<NotFound></NotFound>} ></Route>

          <Route path="/test" element = {<Test></Test>} ></Route>
        </Routes>

  </BrowserRouter>

  );
}

export default App;
