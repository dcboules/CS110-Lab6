import react from "react";
import {io} from 'socket.io-client';
import DefaultPfp from "./../default-pfp.jpg"
import './screens.css'; 

class Chatroom extends react.Component{
    constructor(props){
        super(props);
        this.socket = io('http://localhost:3001', {
        cors: {
        origin: 'http://localhost:3001',
        credentials: true
      }, transports: ['websocket']
    });
      this.state = {
        messages: [],
        message: "",
        searchActive: false,
        filteredMessages: [],
      };
      
      this.socket.on("chat message", (data) => {
        this.setState((prevState) => ({
          messages: [...prevState.messages, data],
        }));
        if (this.state.searchActive) {
          this.filterMessages();
        }
        console.log("all messages in this room: ", this.state.messages)
      });
      
    }

    handleMessageChange = (event) => {
      const { searchActive } = this.state;
      const message = event.target.value;
    
      this.setState({ message }, () => {
        if (searchActive) {
          this.filterMessages();
        }
      });
    };
  
    componentDidMount = (data) => {
      this.socket.emit("join", {"room": this.props.room.name, "username": this.props.user.userName});
      // Get initial message history from the db
      this.fetchMessages();
      // Start long polling to check for new messages periodically
      this.startLongPolling();
    }

    fetchMessages() {
      fetch(this.props.server_url + '/api/messages/' + this.props.room.name, {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      }).then((res) => {
        res.json().then(data => {
          //console.log(data)
          this.setState({ messages: data });
        });
      }).catch((error) => {
        console.log("Error fetching messages:", error);
      });
    }

    pollingTimeout;
    isPolling = false; // Flag to track if a polling request is in progress

    startLongPolling() {
      const pollInterval = 2000; // Polling interval in milliseconds
  
      const checkForNewMessages = () => {
        if (this.isPolling) {
          return; // If a polling request is already in progress, do nothing
        }
  
        this.isPolling = true; // Set the flag to indicate that a request is now in progress
  
        const lastMessageCount = this.state.messages.length;
        const url = `${this.props.server_url}/api/messages/check/${this.props.room.name}?lastMessageCount=${lastMessageCount}`;
  
        fetch(url, {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        })
          .then((res) => {
            if (res.ok) {
              return res.json();
            } else {
              throw new Error("Failed to check for new messages.");
            }
          })
          .then((data) => {
            if (data.newMessages) {
              // New messages are available, so fetch and update the message list
              this.fetchMessages();
            }
          })
          .catch((error) => {
            console.log("Error checking for new messages:", error);
          })
          .finally(() => {
            this.isPolling = false; // Reset the flag to indicate that the request has completed
            this.pollingTimeout = setTimeout(checkForNewMessages, pollInterval);
          });
      };
  
      // Start the initial polling request
      checkForNewMessages();
    }

    componentWillUnmount() {
      clearTimeout(this.pollingTimeout);
    }

    handleSendMessage = () => {
      const data = {
        sender: {
          name: this.props.user.nameOfUser,
          username: this.props.user.userName,
          pfp: this.props.user.pfp
        },
        room: this.props.room.name,
        message: this.state.message
      }
      this.socket.emit("chat message", data);
      this.setState({ message: "" });
      fetch(this.props.server_url + '/api/messages', {
        method: "POST",
        mode: "cors",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        body: JSON.stringify(data),
    }).then((res) => {
        res.json().then((data) => {
            if (data.status === 200) {
            //hi
            }
            else {
                console.log("failed to send message to database")
                alert(data.msg);
            }
        });
    });
    };    

    handleDeleteRoom = () => {
      fetch(this.props.server_url + '/api/rooms/delete', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ "roomID": this.props.room._id, "roomName": this.props.room.name}),
      })
      .then((data) => {
         this.goBack();
      });
  };

  handleLeaveRoom = () => {
    fetch(this.props.server_url + '/api/rooms/leave', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ "roomID": this.props.room._id, "userID": this.props.user.userID}),
    })
    .then((res) => {
        res.json().then(data => {
            this.goBack();
        });
    });

};

    goBack = () => {
      fetch(this.props.server_url + '/api/rooms/all', {
        method: "GET",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
    }).then((res) => {
        res.json().then(data => {
          this.props.setRooms(data);
          this.props.changeScreen("lobby");
        });
    });
    }

    handleSearchToggle = () => {
      this.setState((prevState) => ({
        searchActive: !prevState.searchActive,
      }), () => {
        if (this.state.searchActive) {
          this.filterMessages();
        }
      });
    };

    filterMessages = () => {
      const { messages, searchActive, message } = this.state;
  
      if (searchActive && message.trim() !== "") {
        const filtered = messages.filter((msg) =>
          msg.message.toLowerCase().includes(message.toLowerCase())
        );
        this.setState({ filteredMessages: filtered });
      } else {
        this.setState({ filteredMessages: messages });
      }
    };

    render() { 
      const isCreator = (this.props.user.userID === this.props.room.creator);
      const searchButtonClass = this.state.searchActive ? "msg-button-active" : "msg-button";
      const messages = this.state.searchActive ? this.state.filteredMessages : this.state.messages;
      return (
        <div >
          <h2>Chatroom: {this.props.room.name}</h2>
          <h3>Invite friends with this code: {this.props.room.code}</h3>
          <div className="msg-container">
            {messages.map((message, index) => (
              <div key={index}>
                <div style={{border:"solid #e6ecf0"}}>
                  <div>
                    {console.log(message.sender.name, "herettt")}
                    {message.sender.pfp ?
                    <img src={DefaultPfp} alt="ProfilePic." style={{margin:"20px", objectFit: "contain", height:"100px", width:"100px"}} />
                     :
                    <img src={message.sender.pfp} alt="ProfilePic." style={{margin:"20px", objectFit: "contain", height:"100px", width:"100px"}} />
                    } 
                  </div>
                  <div style={{display: "flex"}}>
                  {message.sender.name}
                  <span style={{fontWeight: "bold"}}> @{message.sender.username} </span>
                  </div>
                  <br/>
                  {message.message}
                  
                {message.sender.username  === this.props.user.userName && <button className="edit-btn" > edit </button>} 
                </div>
              </div>
            ))}
          </div>
          <div className="chat-div">
            <input
              type="text"
              value={this.state.message}
              onChange={this.handleMessageChange}
            />
            <button className="msg-button" onClick={this.handleSendMessage}>Send</button>
            <button className="msg-button" onClick={this.goBack}>Back To Lobby</button>
            <button className={searchButtonClass} onClick={this.handleSearchToggle}>
              {this.state.searchActive ? "Search On" : "Search Off"}
            </button>
            {isCreator ? (
              <button className="msg-button" onClick={this.handleDeleteRoom}>Delete Room</button>
            )
            :
            (
              <button className="msg-button" onClick={this.handleLeaveRoom}>Forget Room</button>
            )
          }
          </div>
        </div>
      );
    }
}

export default Chatroom;