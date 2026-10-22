import react from "react";
import {db} from "./firebase";
import {ref , set , get , child} from "firebase/database";
import {useState , useEffect} from "react";
import {collection , addDoc } from "firebase/firestore";


function Test() {

    const [data , setData] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();

        const message = document.querySelector("#txtbox").value

        await addDoc(collection(db,"text"),{
            message:message,
            date: new Date().toLocaleString()
        })

        
        alert('data uploaded')

        setData("");
    }



  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}} >
      <h1>Test</h1>
      <br></br>

      <form onSubmit={handleSubmit} >
        <input type="text" placeholder="Enter text" name="txt" id="txtbox" ></input>
        <input type="submit" value="Submit" onChange={(e) => setData(e.target.value)}  ></input>
      </form>
    </div>
  )
}

export default Test;