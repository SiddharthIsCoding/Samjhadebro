import react from "react";
import Nav from "./navbar";
import Footer from "./footer";
import { createUserWithEmailAndPassword , updateProfile } from "firebase/auth";
import { auth } from "./firebase";

function Signup() {

    const [email, setEmail] = react.useState("");
    const [password, setPassword] = react.useState("");
    const [name, setName] = react.useState("");

    const handleSignup = async (e) => {
        e.preventDefault();

        try{
            const credential = await createUserWithEmailAndPassword(auth, email, password);

            await updateProfile(credential.user, {
                displayName: name
            });


            alert("account created successfully");
        }
        catch(error){
            alert( error);
        }
    }



    return (
        <div class="loginpage" >
            <Nav></Nav>
            <div class="loginform" >
                <h1>Signup </h1>
                <form onSubmit={handleSignup}> 
                    <input name="name" class="inputbox" type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} ></input><br></br>
                    <input name="email" class="inputbox" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} ></input><br></br>
                    <input name="password" class="inputbox" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} ></input><br></br>
                    <button class="normalbtn" type="submit" >Signup</button>
                </form>

            </div>
            <Footer></Footer>
        </div>
    )
}

export default Signup;