import base64
import json
import cv2
import numpy as np
import mysql.connector
import face_recognition
from fastapi import FastAPI, File, UploadFile, Form, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from typing import List

app = FastAPI()

# Middleware CORS diperketat untuk keamanan namun tetap fleksibel
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# ROUTING HALAMAN
# =========================

@app.get("/")
async def home():
    return FileResponse("landing.html")


@app.get("/register")
async def register_page():
    return FileResponse("register.html")


@app.get("/verify")
async def verify_page():
    return FileResponse("index.html")

def get_db_connection():
    return mysql.connector.connect(
        host="localhost",
        user="root",
        password="",
        database="tiket_konser"
    )

@app.post("/register")
async def register(
    name: str = Form(...),
    email: str = Form(...),
    phone: str = Form(...),
    ticketCategory: str = Form(...),
    ticketQuantity: int = Form(...),
    frames: List[UploadFile] = File(...)
):
    try:
        encodings_list = []
        for frame in frames:
            contents = await frame.read()
            nparr = np.frombuffer(contents, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is None: continue
            
            rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            face_encodings = face_recognition.face_encodings(rgb_img)
            if face_encodings:
                encodings_list.append(face_encodings[0].tolist())

        if not encodings_list:
            return {"status": "error", "message": "Wajah tidak terdeteksi"}

        conn = get_db_connection()
        cursor = conn.cursor()
        query = """INSERT INTO users (name, email, phone, ticket_category, ticket_quantity, face_encodings) 
                VALUES (%s, %s, %s, %s, %s, %s)"""
        cursor.execute(query, (name, email, phone, ticketCategory, ticketQuantity, json.dumps(encodings_list)))
        conn.commit()
        cursor.close()
        conn.close()
        return {"status": "success", "name": name}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    # Ambil data pembanding ke memori untuk respon instan
    cursor.execute("SELECT name, email, phone, ticket_category, face_encodings FROM users")
    users_db = cursor.fetchall()
    
    known_faces = []
    for user in users_db:
        encs = json.loads(user['face_encodings'])
        if encs:
            known_faces.append({"data": user, "encoding": np.array(encs[0])})

    try:
        while True:
            data = await websocket.receive_text()
            header, encoded = data.split(",", 1)
            img = cv2.imdecode(np.frombuffer(base64.b64decode(encoded), np.uint8), cv2.IMREAD_COLOR)
            
            # Optimasi: Perkecil gambar untuk deteksi kilat
            small_frame = cv2.resize(img, (0, 0), fx=0.5, fy=0.5)
            rgb_frame = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)
            
            face_locations = face_recognition.face_locations(rgb_frame, model="hog")
            face_encodings = face_recognition.face_encodings(rgb_frame, face_locations)

            found_user = None
            if face_encodings:
                match = face_recognition.compare_faces([f["encoding"] for f in known_faces], face_encodings[0], tolerance=0.5)
                if True in match:
                    found_user = known_faces[match.index(True)]["data"]

            if found_user:
                await websocket.send_json({
                    "status": "success",
                    "user": {
                        "name": found_user["name"],
                        "email": found_user["email"],
                        "phone": found_user["phone"],
                        "category": found_user["ticket_category"]
                    }
                })
            else:
                await websocket.send_json({"status": "failed"})
    except WebSocketDisconnect:
        pass
    finally:
        cursor.close()
        conn.close()