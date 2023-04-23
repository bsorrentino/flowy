import type { FlowyDiagram } from 'flowy-engine'

export const blockType =  ( block: HTMLElement ) => block.getAttribute('blockelemtype')

export const isBlockAlreadyLinked = ( diagram:FlowyDiagram, id:string|number  ) => {

    let blockId:string =  ( typeof(id) == 'number' ) ?  `block${id}` : id

    // const selector = `div[parent='${blockId}']`
    const selector = `.arrowblock[source='${blockId}']`
    const e = diagram.querySelector( selector )

    if( e ) {
        console.debug( `reject link to element (${blockId})` )
        return true
    }

    return false

}

export const numBlockLinked = ( diagram:FlowyDiagram, id:string|number  ) => {

    let blockId:string =  ( typeof(id) == 'number' ) ?  `block${id}` : id

    // const selector = `div[parent='${blockId}']`
    const selector = `.arrowblock[source='${blockId}']`
    const e = diagram.querySelectorAll( selector )

    return e.length

}
