import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

export function DroneControls({ isPaused }: { isPaused: boolean }) {
  const { camera, gl } = useThree()

  const keys = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false
  })

  const isMouseDown = useRef(false)
  const mousePos = useRef({ x: 0, y: 0 })
  const euler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'))

  useEffect(() => {
    euler.current.setFromQuaternion(camera.quaternion)

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW':
          keys.current.forward = true
          break
        case 'ArrowDown':
        case 'KeyS':
          keys.current.backward = true
          break
        case 'ArrowLeft':
        case 'KeyA':
          keys.current.left = true
          break
        case 'ArrowRight':
        case 'KeyD':
          keys.current.right = true
          break
        case 'Space':
          keys.current.up = true
          break
        case 'ShiftLeft':
        case 'ShiftRight':
          keys.current.down = true
          break
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW':
          keys.current.forward = false
          break
        case 'ArrowDown':
        case 'KeyS':
          keys.current.backward = false
          break
        case 'ArrowLeft':
        case 'KeyA':
          keys.current.left = false
          break
        case 'ArrowRight':
        case 'KeyD':
          keys.current.right = false
          break
        case 'Space':
          keys.current.up = false
          break
        case 'ShiftLeft':
        case 'ShiftRight':
          keys.current.down = false
          break
      }
    }

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        isMouseDown.current = true
        mousePos.current = { x: e.clientX, y: e.clientY }
      }
    }

    const handleMouseUp = () => {
      isMouseDown.current = false
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isMouseDown.current) return

      const movementX = e.clientX - mousePos.current.x
      const movementY = e.clientY - mousePos.current.y
      mousePos.current = { x: e.clientX, y: e.clientY }

      euler.current.y -= movementX * 0.003
      euler.current.x -= movementY * 0.003
      euler.current.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, euler.current.x))

      camera.quaternion.setFromEuler(euler.current)
    }

    const domElement = gl.domElement
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    domElement.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('mousemove', handleMouseMove)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      domElement.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [camera, gl])

  useFrame((_, delta) => {
    if (isPaused) return

    const moveSpeed = 18 * delta
    const moveVector = new THREE.Vector3()

    if (keys.current.forward) moveVector.z -= 1
    if (keys.current.backward) moveVector.z += 1
    if (keys.current.left) moveVector.x -= 1
    if (keys.current.right) moveVector.x += 1

    moveVector.normalize()
    moveVector.applyQuaternion(camera.quaternion)

    if (keys.current.up) moveVector.y += 1
    if (keys.current.down) moveVector.y -= 1

    camera.position.addScaledVector(moveVector, moveSpeed)
  })

  return null
}