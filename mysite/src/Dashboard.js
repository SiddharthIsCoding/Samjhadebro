import react from 'react';
import './App.css';
import Normalbutton from "./Normalbtn";
import Nav from './navbar';
import Footer from "./footer";
import {auth} from "./firebase";
import {signOut} from "firebase/auth";

function Dashboard(){

    const signout = async () => {
        try{
            await signOut(auth);
            alert("Logout successful");
        } catch (error) {
            console.error("Error signing out:", error);
        }
    };

  return (
    <div>
      <Nav></Nav>

      <h1>Welcome to Dashboard</h1>

      <button className="normalbtn" onClick={signout}>Logout</button>

      <Footer></Footer>
    </div>
  )
}


export default Dashboard;