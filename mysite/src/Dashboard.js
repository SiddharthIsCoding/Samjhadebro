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
    <div style={{textAlign:"left"}} >
      <Nav></Nav>

      <div onClick={() => {
        document.getElementById('class-form').style.display = 'none';
        document.getElementById('blackfilter').style.display = 'none';
      }} id="blackfilter" ></div>

      <button onClick={() => {
        document.getElementById('class-form').style.display = 'block';
        document.getElementById('blackfilter').style.display = 'block';
      }} className='normalbtn' style={{background:"gray",width:150 , margin:30,marginTop:40}} >+ Create class</button>


      <div id="class-form" >
        <form>
          <h1 style={{fontSize:30}} >Class details</h1>

          <input placeholder='Topic(s) to be discussed' className='inputbox' type='text' id='topic' name='topic' ></input>
          <br></br>
          <input placeholder='Venue of discussion 📍 ' className='inputbox' type='text' id='venue' name='venue' ></input>
          <br></br>
          <textarea placeholder='Details about the class' style={{height:"20vh",marginTop:20,padding:20}} className='inputbox' >
          </textarea>

          <br></br>

          <button className='normalbtn' >Create</button>

        </form>
      </div>
      


      <Footer></Footer>
    </div>
  )
}


export default Dashboard;