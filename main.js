/* DATA */

const classPrefix = 'reddit-bot-marker'

const classes = {
    traversedComment: `${classPrefix}-traversed-comment`,
    authorChip: `${classPrefix}-author-chip`,
    markWrapper: `${classPrefix}-mark-wrapper`,
    markMenu: `${classPrefix}-mark-menu`,
    markButtonVariant: `${classPrefix}-mark-button-variant`,
    removeMarkButton: `${classPrefix}-remove-button`,
    botChip: `${classPrefix}-bot-chip`,
    susChip: `${classPrefix}-sus-chip`,
}

const css = `
    .${classes.authorChip} {
        border-radius: 3px;
        padding: 2px 4px;
        margin: 2px 4px;
        color: white;
        font-size: 14px;
    }

    .${classes.markWrapper} {
        position: relative;
    }

    .${classes.markMenu} {
        display: none;
        position: absolute;
        z-index: 1;
    }

    .${classes.markWrapper}:hover .${classes.markMenu} {
        display: block;
    }

    .${classes.markButtonVariant} {
        min-width: 100px;
    }

    .${classes.botChip} {
        background-color: #df2a2a;
    }

    .${classes.susChip} {
        background-color: #bd6829;
    }
`

const BOT_TYPES = {
    bot: {
        storageKey: 'bot',
        displayName: 'Bot',
        className: classes.botChip
    },
    sus: {
        storageKey: 'sus',
        displayName: 'Sus',
        className: classes.susChip
    }
}

const CHECK_COMMENTS_INTERVAL = 2 * 1000

/* DOM MANIPULATION  */

const getNewComments = () => document.querySelectorAll(`.Comment:not(.${classes.traversedComment})`)

const getAuthorContainer = commentNode =>
    commentNode.lastChild?.querySelector('div')?.firstChild

const getButtonsContainer = commentNode =>
    commentNode.lastChild?.lastChild?.lastChild

const getCommentAuthor = authorContainer =>
    authorContainer.firstChild?.firstChild?.firstChild?.textContent

const getMarkButton = buttonsContainer => {
    const markButton = buttonsContainer.querySelector('button:last-child')?.cloneNode()

    if (!markButton) return null

    markButton.textContent = 'Mark as Bot'

    return markButton
}

const getCommentAuthorChip = botType => {
    const authorChip = document.createElement('span')
    authorChip.textContent = BOT_TYPES[botType].displayName
    authorChip.className = `${classes.authorChip} ${BOT_TYPES[botType].className || ''}`

    return authorChip
}

const injectStyle = cssString => {
    const style = document.createElement('style')
    style.textContent = cssString
    document.head.append(style)
}

const clearAllModifications = commentNode => {
    const selectors = [
        `.${classes.authorChip}`,
        `.${classes.markWrapper}`,
        `.${classes.removeMarkButton}`
    ]
    selectors.forEach(selector => commentNode.querySelector(selector)?.remove())
}

/* MAIN LOGIC */

const setDOMCheck = commentsMap => {
    setInterval(async commentsMap => {
        const comments = getNewComments()

        if (comments.length === 0) return

        await renderNewComments(comments, commentsMap)
    }, CHECK_COMMENTS_INTERVAL, commentsMap)
}

// ! Mutates commentsMap !
const renderNewComments = async (comments, commentsMap) => {
    const authors = new Set()

    comments.forEach(commentNode => {
        const author = getCommentAuthor(getAuthorContainer(commentNode))

        if (author) authors.add(author)

        commentNode.className += ` ${classes.traversedComment}`
    })

    const authorsBotTypes = await browser.storage.local.get([...authors])

    comments.forEach(commentNode => {
        const author = getCommentAuthor(getAuthorContainer(commentNode))

        if (!commentsMap[author]) commentsMap[author] = []
        commentsMap[author] = [...commentsMap[author], commentNode]

        renderComment({ commentNode, author, botType: authorsBotTypes[author] })
    })
}

const renderComment = ({ commentNode, author, botType }) => {
    clearAllModifications(commentNode)

    const buttonsContainer = getButtonsContainer(commentNode)
    const authorContainer = getAuthorContainer(commentNode)

    if (!buttonsContainer || !authorContainer) return

    const markButton = getMarkButton(buttonsContainer)

    if (!markButton) return

    if (botType) {
        const authorChip = getCommentAuthorChip(botType)

        authorContainer.append(authorChip)

        markButton.textContent = 'Remove bot mark'
        markButton.className +=` ${classes.removeMarkButton}`
        markButton.addEventListener('click', () =>
            browser.storage.local.remove(author)
        )

        buttonsContainer.append(markButton)
    
        return
    }

    const markWrapper = document.createElement('div')
    markWrapper.className = classes.markWrapper

    const markMenu = document.createElement('div')
    markMenu.className = classes.markMenu

    const markButtonVariants = Object.entries(BOT_TYPES).map(([key, botType]) => {
        const markButtonVariant = markButton.cloneNode()

        markButtonVariant.textContent = botType.displayName
        markButtonVariant.className += ` ${classes.markButtonVariant}`
        markButtonVariant.addEventListener('click', () =>
            browser.storage.local.set({
                [author]: botType.storageKey
            })
        )

        return markButtonVariant
    })

    markMenu.append(...markButtonVariants)
    markWrapper.append(markButton, markMenu)
    buttonsContainer.append(markWrapper)
}

const main = async () => {
    const commentsMap = {}

    injectStyle(css)

    setDOMCheck(commentsMap)

    const onStorageChange = changes => {
        const changedAuthor = Object.keys(changes)[0]

        if (commentsMap[changedAuthor]) {
            commentsMap[changedAuthor].forEach(commentNode => {
                renderComment({
                    commentNode, author: changedAuthor, botType: changes[changedAuthor].newValue
                })
            })
        }
    }

    browser.storage.onChanged.addListener(onStorageChange)
}

/* ENTRY POINT */

window.addEventListener('load', main)