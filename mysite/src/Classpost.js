import react from 'react';


function Post(props){
    return(
        <div className='post' >
            <h1>{props.title}</h1>
            <p>{props.content}</p>
        </div>
    )
}


export default Post;