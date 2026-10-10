import react from 'react';
import './App.css';
import Normalbutton from "./Normalbtn";
import Nav from './navbar';
import Footer from "./footer";
import {auth} from "./firebase";
import {signOut} from "firebase/auth";
import {onAuthStateChanged} from "firebase/auth";

function Dashboard(){


    const signout = async () => {
        try{
            await signOut(auth);
            alert("Logout successful");
        } catch (error) {
            console.error(error);
        }
    };

    const [userName, setUserName] = react.useState("");


    onAuthStateChanged(auth, (user) => {
        if (user) {
            setUserName(user.displayName);
        } else{
          setUserName("")
        }
    });

  return (
    <div>
      <Nav></Nav>



      <Footer></Footer>
    </div>
  )
}


export default Dashboard;